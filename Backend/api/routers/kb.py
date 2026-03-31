# api/routers/kb.py
"""
Knowledge-Base router — handles PDF upload, chunking, embedding, and ChromaDB storage.

Embedding strategy:
  - Default: ensemble (Gemini-384 + ST-384 averaged → 384-dim)
  - Fallback 1: sentence-transformers only (384-dim)
  - Fallback 2: Gemini only (384-dim via output_dimensionality)
  - All three produce 384-dim vectors so ChromaDB collection stays consistent.
"""

import os
import json
import uuid
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from db.database import get_workflow_by_id
from utils.auth_utils import get_current_user_id
from utils.chroma_client import get_chroma_collection
from utils.encryption import decrypt
from utils.pdf_parser import extract_text_from_pdf
from utils.text_splitter import split_text_into_chunks
from utils.gemini_client import (
    embed_document_ensemble,
    embed_document_gemini,
    embed_document_sentence_transformer,
)

router = APIRouter()


def _require_user(authorization: Optional[str]) -> str:
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user_id


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    gemini_api_key: str = Form(...),
    workflow_id: Optional[str] = Form(None),
    embedding_model: Optional[str] = Form("gemini-embedding-001"),
    authorization: Optional[str] = Header(None),
):
    """
    Upload a PDF, chunk it, embed each chunk, and store in ChromaDB.

    Returns the number of chunks stored and the KB ID (= workflow_id).
    """
    user_id = _require_user(authorization)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # ── Resolve embedding API key ────────────────────────────────────────────
    embedding_api_key = gemini_api_key
    if workflow_id:
        workflow = await get_workflow_by_id(workflow_id)
        if not workflow or workflow.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Workflow not found.")
        config = workflow.get("config", {})
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except Exception:
                config = {}
        wf_emb_key = config.get("embedding_api_key")
        if wf_emb_key:
            try:
                embedding_api_key = decrypt(wf_emb_key)
            except Exception:
                embedding_api_key = gemini_api_key   # use form key as fallback

    print(f"[{datetime.now()}] KB upload: file='{file.filename}' workflow='{workflow_id}'")

    temp_pdf_path = None
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            temp_pdf_path = tmp.name

        # ── Extract text ─────────────────────────────────────────────────────
        text = extract_text_from_pdf(temp_pdf_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

        # ── Chunk text ───────────────────────────────────────────────────────
        chunks = split_text_into_chunks(text)
        print(f"[{datetime.now()}] KB: {len(chunks)} chunks to embed.")

        collection = get_chroma_collection(collection_name="doc_chunks")

        ids, embeddings, docs, metas = [], [], [], []

        for i, chunk in enumerate(chunks):
            emb = None
            model_used = "ensemble-gemini-st"

            # Try ensemble first
            try:
                emb = embed_document_ensemble(text_chunk=chunk, api_key=embedding_api_key)
                print(f"[{datetime.now()}] Chunk {i}: ensemble OK")
            except Exception as exc:
                print(f"[{datetime.now()}] Chunk {i}: ensemble failed: {exc}")

            # Fallback → sentence-transformers
            if emb is None:
                try:
                    emb = embed_document_sentence_transformer(text_chunk=chunk)
                    model_used = "sentence-transformers"
                    print(f"[{datetime.now()}] Chunk {i}: ST fallback OK")
                except Exception as exc:
                    print(f"[{datetime.now()}] Chunk {i}: ST failed: {exc}")

            # Fallback → Gemini only
            if emb is None:
                try:
                    emb = embed_document_gemini(text_chunk=chunk, api_key=embedding_api_key)
                    model_used = "gemini-embedding-001"
                    print(f"[{datetime.now()}] Chunk {i}: Gemini-only fallback OK")
                except Exception as exc:
                    print(f"[{datetime.now()}] Chunk {i}: all embedding methods failed: {exc}")
                    continue   # skip this chunk

            chunk_id = f"{workflow_id or 'standalone'}-{file.filename}-{i}-{uuid.uuid4().hex[:8]}"
            ids.append(chunk_id)
            embeddings.append(emb)
            docs.append(chunk)
            metas.append({
                "workflow_id":    workflow_id or "standalone",
                "document_name":  file.filename,
                "chunk_index":    i,
                "user_id":        user_id,
                "embedding_model": model_used,
            })

        if not embeddings:
            raise HTTPException(status_code=500, detail="No chunks could be embedded.")

        collection.add(embeddings=embeddings, documents=docs, metadatas=metas, ids=ids)
        print(f"[{datetime.now()}] KB: stored {len(ids)} chunks.")

        return {
            "kb_id":          workflow_id or "standalone",
            "filename":       file.filename,
            "chunks_stored":  len(ids),
            "message":        f"Stored {len(ids)} chunks from '{file.filename}'.",
        }

    finally:
        if temp_pdf_path and os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)


@router.get("/documents")
async def list_documents(
    workflow_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """List all documents in the KB, optionally filtered by workflow_id."""
    user_id = _require_user(authorization)
    try:
        collection = get_chroma_collection(collection_name="doc_chunks")
        where_filter = {"user_id": user_id}
        if workflow_id:
            where_filter["workflow_id"] = workflow_id

        results = collection.get(where=where_filter)

        doc_map = {}
        if results and results.get("ids"):
            for i, _ in enumerate(results["ids"]):
                meta     = results["metadatas"][i]
                doc_name = meta.get("document_name", "unknown")
                if doc_name not in doc_map:
                    doc_map[doc_name] = {
                        "document_name": doc_name,
                        "workflow_id":   meta.get("workflow_id"),
                        "chunks":        0,
                        "ids":           [],
                    }
                doc_map[doc_name]["chunks"] += 1
                doc_map[doc_name]["ids"].append(results["ids"][i])

        return {"documents": list(doc_map.values())}
    except Exception as exc:
        print(f"[{datetime.now()}] list_documents error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc