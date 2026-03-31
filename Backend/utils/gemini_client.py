"""
gemini_client.py
----------------
Utilities for:
  - Text generation  : gemini-2.5-flash (primary) → gemini-2.5-flash-preview-04-17
                       → gemini-2.0-flash → gemini-1.5-flash 
                       → TinyLlama-1.1B (fast HF fallback ~600MB)
  - Text embedding   : gemini-embedding-001 (dim=384 via output_dimensionality)
                       → all-MiniLM-L6-v2 sentence-transformer (dim=384)
  - Ensemble embed   : average(Gemini-384, ST-384) → 384-dim (matches ChromaDB collection)

Official Gemini Documentation:
  - Models Overview: https://ai.google.dev/gemini-api/docs/models
  - Text Generation: https://ai.google.dev/gemini-api/docs/text-generation
  - Embeddings: https://ai.google.dev/gemini-api/docs/embeddings
  - Model Pricing: https://ai.google.dev/pricing

Valid Gemini Models (as of 2024):
  - gemini-2.5-flash: Latest stable flash model with high performance
  - gemini-2.5-flash-preview-04-17: Preview version of gemini-2.5-flash
  - gemini-2.0-flash: Previous generation flash model
  - gemini-1.5-flash: Older stable flash model
  - gemini-embedding-001: Text embedding model (384 dimensions)
"""

from __future__ import annotations
from typing import List, Optional
import numpy as np

# Gemini SDK
from google import genai
from google.genai import types
from google.genai.types import EmbedContentConfig

# Sentence-Transformers
from sentence_transformers import SentenceTransformer

# HuggingFace Transformers
import torch
from transformers import pipeline

# Constants
# Gemini 2.5 Flash is the latest stable model with improved performance
# See: https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2-5-flash
GEMINI_PRIMARY_MODEL     = "gemini-2.5-flash"
GEMINI_GENERATION_MODELS = [
    GEMINI_PRIMARY_MODEL,
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]
GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM          = 384        # shared dim for ChromaDB collection
# Fast/small HuggingFace fallback (~600 MB, CPU-friendly)
HF_FALLBACK_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# Module-level singletons
_gemini_client: Optional[genai.Client] = None
_sentence_model: Optional[SentenceTransformer] = None
_hf_pipe = None


# Gemini client

def _get_gemini_client(api_key: str) -> genai.Client:
    global _gemini_client
    if not api_key:
        raise ValueError("Gemini API key is required.")
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=api_key)
        print("Gemini: client initialised.")
    return _gemini_client


def get_gemini_model(api_key: str, model_name: str = GEMINI_PRIMARY_MODEL):
    """Compatibility shim — returns the client."""
    return _get_gemini_client(api_key)


def get_gemini_embedding_model(api_key: str):
    """Compatibility shim — ensures client is ready."""
    return _get_gemini_client(api_key)


# Sentence-Transformers embedding  (dim=384)

def _get_sentence_model() -> SentenceTransformer:
    global _sentence_model
    if _sentence_model is None:
        print("Loading sentence-transformer: all-MiniLM-L6-v2 …")
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("sentence-transformer loaded (dim=384).")
    return _sentence_model


def embed_document_sentence_transformer(text_chunk: str) -> List[float]:
    """Embed with all-MiniLM-L6-v2 → 384-dim L2-normalised vector."""
    if not text_chunk:
        raise ValueError("text_chunk cannot be empty.")
    vec = _get_sentence_model().encode(
        text_chunk, convert_to_numpy=True, normalize_embeddings=True
    )
    return vec.tolist()


# Gemini embedding  (dim = EMBEDDING_DIM = 384)

def embed_document_gemini(
    text_chunk: str,
    api_key: str,
    model_name: str = GEMINI_EMBEDDING_MODEL,
    output_dim: int = EMBEDDING_DIM,
) -> List[float]:
    """
    Embed with Gemini embedding model, requesting output_dim=384.
    Falls back to sentence-transformers on any error.
    """
    if not text_chunk:
        raise ValueError("text_chunk cannot be empty.")
    if not api_key:
        raise ValueError("Gemini API key is required.")
    try:
        client = _get_gemini_client(api_key)
        print(f"Gemini embed: model='{model_name}' dim={output_dim} textlen={len(text_chunk)}")
        response = client.models.embed_content(
            model=model_name,
            contents=text_chunk,
            config=EmbedContentConfig(output_dimensionality=output_dim),
        )
        if hasattr(response, "embeddings") and response.embeddings:
            vec = list(response.embeddings[0].values)
            print(f"Gemini embed: got {len(vec)}-dim vector.")
            return vec
        raise RuntimeError("No 'embeddings' field in Gemini response.")
    except Exception as exc:
        print(f"Gemini embed failed: {exc}. Falling back to sentence-transformers.")
        return embed_document_sentence_transformer(text_chunk)


# Ensemble embedding  (Gemini-384 + ST-384, averaged → 384)

def embed_document_ensemble(text_chunk: str, api_key: str) -> List[float]:
    """
    384-dim vector = average(Gemini-384, ST-384), L2-normalised.
    Gracefully degrades to a single source if the other fails.
    """
    if not text_chunk:
        raise ValueError("text_chunk cannot be empty.")

    gemini_vec: Optional[np.ndarray] = None
    st_vec: Optional[np.ndarray] = None

    try:
        raw = embed_document_gemini(text_chunk=text_chunk, api_key=api_key, output_dim=EMBEDDING_DIM)
        gemini_vec = np.array(raw, dtype=np.float32)
        print(f"Ensemble: Gemini vec shape={gemini_vec.shape}")
    except Exception as exc:
        print(f"Ensemble: Gemini failed: {exc}")

    try:
        st_vec = np.array(embed_document_sentence_transformer(text_chunk), dtype=np.float32)
        print(f"Ensemble: ST vec shape={st_vec.shape}")
    except Exception as exc:
        print(f"Ensemble: ST failed: {exc}")

    if gemini_vec is not None and st_vec is not None:
        combined = (gemini_vec + st_vec) / 2.0
        norm = np.linalg.norm(combined)
        if norm > 1e-9:
            combined /= norm
        print("Ensemble: averaged Gemini + ST vectors (dim=384).")
        return combined.tolist()
    if gemini_vec is not None:
        return gemini_vec.tolist()
    if st_vec is not None:
        return st_vec.tolist()
    raise RuntimeError("All embedding methods failed in ensemble.")


# HuggingFace TinyLlama fallback LLM  (~600 MB, fast CPU inference)

def _get_hf_pipeline():
    global _hf_pipe
    if _hf_pipe is None:
        print(f"Loading HuggingFace fallback LLM: {HF_FALLBACK_MODEL} …")
        device = 0 if torch.cuda.is_available() else -1
        dtype  = torch.float16 if torch.cuda.is_available() else torch.float32
        _hf_pipe = pipeline(
            "text-generation",
            model=HF_FALLBACK_MODEL,
            torch_dtype=dtype,
            device=device,
        )
        print(f"HuggingFace TinyLlama loaded (device={'cuda' if device == 0 else 'cpu'}).")
    return _hf_pipe


def generate_huggingface_llm(prompt: str, max_new_tokens: int = 256) -> str:
    """Generate text via TinyLlama-1.1B-Chat (fast HuggingFace fallback)."""
    pipe = _get_hf_pipeline()
    messages = [{"role": "user", "content": prompt}]
    formatted = pipe.tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    result = pipe(
        formatted,
        max_new_tokens=max_new_tokens,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        repetition_penalty=1.1,
        return_full_text=False,
    )
    text = result[0]["generated_text"].strip()
    print(f"TinyLlama generated {len(text)} chars.")
    return text


# Main text-generation entry point

def generate_content(
    prompt: str,
    api_key: str,
    model_name: str = GEMINI_PRIMARY_MODEL,
    temperature: float = 0.7,
) -> str:
    """
    Generate text:
      1. Try Gemini models in order (preferred model_name first, then fallbacks).
      2. On total Gemini failure → TinyLlama (HuggingFace).

    Returns generated text string.
    """
    if not prompt:
        raise ValueError("Prompt cannot be empty.")
    if not api_key:
        raise ValueError("Gemini API key is required.")

    # Build deduplicated model list, preferred model first
    models_to_try: List[str] = []
    if model_name and model_name not in GEMINI_GENERATION_MODELS:
        models_to_try.append(model_name)
    for m in GEMINI_GENERATION_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error: Optional[Exception] = None
    for model in models_to_try:
        try:
            client = _get_gemini_client(api_key)
            print(f"Generating content with Gemini model '{model}' …")
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=temperature),
            )
            if hasattr(response, "text") and response.text:
                print(f"Gemini '{model}': {len(response.text)} chars.")
                return response.text
            raise RuntimeError("Gemini response has no .text.")
        except Exception as exc:
            print(f"Gemini model '{model}' failed: {exc}")
            last_error = exc

    # All Gemini models failed → TinyLlama
    print("All Gemini models failed. Falling back to TinyLlama …")
    try:
        return generate_huggingface_llm(prompt=prompt)
    except Exception as hf_exc:
        print(f"TinyLlama fallback failed: {hf_exc}")
        raise RuntimeError(
            f"All generation methods failed. Gemini error: {last_error}. HF error: {hf_exc}"
        ) from last_error