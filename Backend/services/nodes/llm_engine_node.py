# services/nodes/llm_engine_node.py
"""
LLM Engine Node — generates a final answer given:
  - user query
  - knowledge-base context (optional)
  - web-search context (optional)
  - custom system prompt (optional)

Generation order: Gemini (2.5-flash → 2.5-flash-preview-04-17 → 2.0-flash → 1.5-flash) → TinyLlama fallback.

Official Gemini Documentation:
  - Models: https://ai.google.dev/gemini-api/docs/models
  - Text Generation: https://ai.google.dev/gemini-api/docs/text-generation
"""

from typing import Optional, Dict, Any
import httpx
import json
import urllib.parse
from fastapi import HTTPException
from utils.gemini_client import generate_content, generate_huggingface_llm, GEMINI_GENERATION_MODELS

# Models exposed to the orchestrator for selection
# These are valid Gemini models as per official documentation:
# https://ai.google.dev/gemini-api/docs/models/gemini#model-variations
DEFAULT_MODELS = GEMINI_GENERATION_MODELS

# Web-search helpers
async def _wikipedia_search(query: str) -> str:
    """Free Wikipedia API search — used when no SerpAPI key is provided."""
    print(f"Wikipedia: searching for '{query}'")
    search_url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "utf8": 1,
        "srlimit": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(search_url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("query", {}).get("search", [])[:3]:
            title = item["title"]
            summary_url = (
                f"https://en.wikipedia.org/api/rest_v1/page/summary/"
                f"{urllib.parse.quote(title)}"
            )
            async with httpx.AsyncClient(timeout=20.0) as client:
                s = await client.get(summary_url)
            if s.status_code == 200:
                extract = s.json().get("extract", "")
                if extract:
                    results.append(
                        f"Title: {title}\nSummary: {extract}\n"
                        f"Source: https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}"
                    )
        if results:
            print(f"Wikipedia: {len(results)} result(s).")
            return "\n\n---\n\n".join(results)
        print("Wikipedia: no results.")
        return ""
    except Exception as exc:
        print(f"Wikipedia error: {exc}")
        return ""


async def perform_wikipedia_search(query: str) -> str:
    return await _wikipedia_search(query)


async def perform_serp_search(query: str, serp_api_key: str, num_results: int = 10) -> str:
    """SerpAPI Google search."""
    if not serp_api_key:
        return ""
    url = "https://serpapi.com/search"
    params = {
        "api_key": serp_api_key,
        "q": query,
        "num": num_results,
        "engine": "google",
        "output": "json",
    }
    print(f"SerpAPI: searching '{query}'")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        snippets = []
        for r in data.get("organic_results", [])[:num_results]:
            title   = r.get("title", "")
            snippet = r.get("snippet", "")
            link    = r.get("link", "")
            if snippet:
                snippets.append(f"Title: {title}\nContent: {snippet}\nSource: {link}")
        if snippets:
            print(f"SerpAPI: {len(snippets)} result(s).")
            return "\n\n---\n\n".join(snippets)
        return ""
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=500, detail=f"SerpAPI HTTP error: {exc}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=500, detail=f"SerpAPI request error: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"SerpAPI parse error: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SerpAPI unexpected error: {exc}") from exc



# Main entry point


async def generate_response(
    query: str,
    context: Optional[str],
    custom_prompt: Optional[str],
    model_name: str,
    llm_api_key: Optional[str],
    serp_api_key: Optional[str],
    web_search_enabled: bool,
    temperature: float,
) -> Dict[str, Any]:
    """
    Build a full RAG prompt and generate a response.

    Args:
        query             : User question.
        context           : Knowledge-base context (may be empty).
        custom_prompt     : Optional system/instruction prefix.
        model_name        : Preferred Gemini model.
        llm_api_key       : Decrypted Gemini API key.
        serp_api_key      : Decrypted SerpAPI key (optional).
        web_search_enabled: Whether to perform web search.
        temperature       : LLM sampling temperature.

    Returns:
        {"response": "<generated text>"}
    """
    print(f"LLMEngineNode: query='{query[:80]}' model='{model_name}'")

    #  1. Web search (if enabled) 
    web_ctx = ""
    if web_search_enabled:
        if serp_api_key:
            print("LLMEngineNode: running SerpAPI search …")
            web_ctx = await perform_serp_search(query=query, serp_api_key=serp_api_key)
        else:
            print("LLMEngineNode: no SerpAPI key — using Wikipedia fallback …")
            web_ctx = await _wikipedia_search(query)

    #  2. If no LLM key, return raw search results or error
    if not llm_api_key:
        if web_ctx:
            print("LLMEngineNode: no LLM key — returning raw web results.")
            return {"response": f"Web Search Results:\n{web_ctx}"}
        raise HTTPException(
            status_code=400,
            detail="An LLM API key is required when web search is disabled or returns no results.",
        )

    #  3. Auto-fetch web context if KB context is empty 
    has_kb = bool(context and context.strip())
    if not has_kb and web_search_enabled and not web_ctx:
        if serp_api_key:
            print("LLMEngineNode: no KB context — auto-fetching from SerpAPI …")
            web_ctx = await perform_serp_search(query=query, serp_api_key=serp_api_key)
        else:
            print("LLMEngineNode: no KB context — auto-fetching from Wikipedia …")
            web_ctx = await _wikipedia_search(query)

    #  4. Build final prompt ─
    parts = []
    if custom_prompt:
        parts.append(f"System Instruction:\n{custom_prompt}\n")
    if context and context.strip():
        parts.append(f"Knowledge Base Context:\n{context}\n")
    if web_ctx:
        parts.append(f"Web Search Results:\n{web_ctx}\n")
    parts.append(f"User Query: {query}")
    final_prompt = "\n\n".join(parts).strip()

    print(f"LLMEngineNode: prompt preview: '{final_prompt[:200]}…'")

    #  5. Generate response (Gemini → TinyLlama fallback) ─
    try:
        # Normalise model_name: if it's not a known Gemini model, use the primary
        safe_model = (
            model_name
            if model_name in DEFAULT_MODELS
            else DEFAULT_MODELS[0]
        )
        llm_response = generate_content(
            prompt=final_prompt,
            api_key=llm_api_key,
            model_name=safe_model,
            temperature=temperature,
        )
        print(f"LLMEngineNode: response preview: '{llm_response[:200]}…'")
        return {"response": llm_response}
    except Exception as exc:
        print(f"LLMEngineNode: generation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"LLMEngineNode error: {exc}") from exc
