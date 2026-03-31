# services/nodes/knowledge_base_node.py
"""
Retrieves relevant context from ChromaDB for a given query.

Embedding strategy (must match what was used at upload time):
  - "ensemble-gemini-st"   → ensemble embedding (Gemini-384 + ST-384)
  - "sentence-transformers" → all-MiniLM-L6-v2 only
  - anything else (Gemini)  → ensemble first, then individual fallbacks
"""

from typing import Dict, Any
from fastapi import HTTPException
from utils.gemini_client import (
    embed_document_ensemble,
    embed_document_gemini,
    embed_document_sentence_transformer,
)
from utils.chroma_client import get_chroma_collection


async def process_knowledge_retrieval(
    query: str,
    workflow_id: str,
    embedding_api_key: str,
    embedding_model: str = "gemini-embedding-001",
    top_n_results: int = 5,
) -> Dict[str, Any]:
    """
    Query ChromaDB for chunks relevant to *query* scoped to *workflow_id*.

    Returns:
        {"context": "<concatenated relevant chunks>"}
    """
    print(f"KnowledgeBaseNode: query='{query[:80]}' workflow='{workflow_id}'")

    try:
        collection = get_chroma_collection(collection_name="doc_chunks")
        print("KnowledgeBaseNode: ChromaDB collection accessed.")

        # Check documents exist for this workflow 
        all_docs = collection.get(where={"workflow_id": workflow_id})
        doc_count = len(all_docs.get("ids", []))
        print(f"KnowledgeBaseNode: {doc_count} chunks found for workflow '{workflow_id}'.")

        if doc_count == 0:
            print("KnowledgeBaseNode: No documents found — returning empty context.")
            return {"context": ""}

        # Determine which embedding model was used at upload time
        stored_model = embedding_model
        if all_docs.get("metadatas") and all_docs["metadatas"]:
            meta = all_docs["metadatas"][0]
            if "embedding_model" in meta:
                stored_model = meta["embedding_model"]
                print(f"KnowledgeBaseNode: stored embedding model = '{stored_model}'")

        # Generate query embedding matching the stored model
        query_embedding = _get_query_embedding(query, stored_model, embedding_api_key)

        if query_embedding is None:
            raise HTTPException(status_code=500, detail="Failed to generate query embedding.")

        # Query ChromaDB
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_n_results, doc_count),
            where={"workflow_id": workflow_id},
        )
        docs_returned = len(results.get("documents", [[]])[0]) if results else 0
        print(f"KnowledgeBaseNode: ChromaDB returned {docs_returned} documents.")

        relevant_context = ""
        if results and results.get("documents"):
            relevant_docs = results["documents"][0]
            if relevant_docs:
                relevant_context = "\n\n".join(relevant_docs)
                print(f"KnowledgeBaseNode: context preview: '{relevant_context[:200]}...'")

    except HTTPException:
        raise
    except Exception as exc:
        print(f"KnowledgeBaseNode error: {exc}")
        raise HTTPException(status_code=500, detail=f"KnowledgeBaseNode error: {exc}") from exc

    return {"context": relevant_context}


def _get_query_embedding(query: str, stored_model: str, api_key: str):
    """
    Generate a query embedding using the same strategy as the stored documents.
    Applies cascading fallbacks so retrieval always has a best-effort embedding.
    """
    # Ensemble (Gemini + ST) 
    if stored_model in ("ensemble-gemini-st", "gemini-embedding-001", ""):
        try:
            vec = embed_document_ensemble(text_chunk=query, api_key=api_key)
            print("KnowledgeBaseNode: query embedded via ensemble.")
            return vec
        except Exception as exc:
            print(f"KnowledgeBaseNode: ensemble embed failed: {exc}. Trying ST …")

        try:
            vec = embed_document_sentence_transformer(text_chunk=query)
            print("KnowledgeBaseNode: query embedded via sentence-transformers (fallback).")
            return vec
        except Exception as exc:
            print(f"KnowledgeBaseNode: ST embed failed: {exc}. Trying Gemini only …")

        try:
            vec = embed_document_gemini(text_chunk=query, api_key=api_key)
            print("KnowledgeBaseNode: query embedded via Gemini only (final fallback).")
            return vec
        except Exception as exc:
            print(f"KnowledgeBaseNode: all embedding methods failed: {exc}")
            raise HTTPException(status_code=500, detail="All embedding methods failed.")

    #Sentence-transformers only
    elif stored_model == "sentence-transformers":
        try:
            vec = embed_document_sentence_transformer(text_chunk=query)
            print("KnowledgeBaseNode: query embedded via sentence-transformers.")
            return vec
        except Exception as exc:
            print(f"KnowledgeBaseNode: ST embed failed: {exc}")
            raise HTTPException(status_code=500, detail=f"ST embedding failed: {exc}") from exc

    # Unknown model — best-effort ensemble 
    else:
        print(f"KnowledgeBaseNode: unknown stored_model='{stored_model}', using ensemble.")
        try:
            return embed_document_ensemble(text_chunk=query, api_key=api_key)
        except Exception as exc:
            print(f"KnowledgeBaseNode: ensemble fallback failed: {exc}")
            raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}") from exc
