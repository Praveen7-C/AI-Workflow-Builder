import os
import json
import uuid
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from api.models.workflow import WorkflowCreateRequest
from db.database import (
    create_workflow as db_create_workflow,
    get_workflow_by_id,
    list_workflows,
    update_workflow as db_update_workflow,
    delete_workflow as db_delete_workflow,
)
from utils.auth_utils import get_current_user_id
from utils.chroma_client import get_chroma_collection
from utils.encryption import encrypt, decrypt
from utils.pdf_parser import extract_text_from_pdf
from utils.text_splitter import split_text_into_chunks
from utils.gemini_client import embed_document_gemini

router = APIRouter()


def _require_user(authorization: Optional[str]) -> str:
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


@router.post("/create")
async def create_workflow(
    payload: WorkflowCreateRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    workflow_id = str(uuid.uuid4())
    workflow = await db_create_workflow(
        id=workflow_id,
        user_id=user_id,
        name=payload.name,
        description=payload.description or "",
    )
    return workflow


@router.get("/list")
async def list_workflows_endpoint(authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    workflows = await list_workflows(user_id)
    return workflows


@router.get("/{workflow_id}")
async def get_workflow_endpoint(
    workflow_id: str,
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    workflow = await get_workflow_by_id(workflow_id)
    if not workflow or workflow.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Workflow not found")

    config = workflow.get("config", {})
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except Exception:
            config = {}

    for key in ("llm_api_key", "embedding_api_key", "serp_api_key"):
        if config.get(key):
            try:
                config[key] = decrypt(config[key])
            except Exception:
                config[key] = "DECRYPTION_ERROR"

    workflow["config"] = config
    return workflow


@router.patch("/update/{workflow_id}")
async def update_workflow_endpoint(
    workflow_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    nodes: str = Form("[]"),
    edges: str = Form("[]"),
    config: str = Form("{}"),
    document_file: Optional[UploadFile] = File(None),
    document_name: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)

    existing = await get_workflow_by_id(workflow_id)
    if not existing or existing.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Workflow not found")

    try:
        parsed_nodes = json.loads(nodes)
        parsed_edges = json.loads(edges)
        parsed_config = json.loads(config)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    updates: Dict[str, Any] = {
        "nodes": parsed_nodes,
        "edges": parsed_edges,
        "config": parsed_config,
    }
    if name is not None:
        updates["name"] = name
    if description is not None:
        updates["description"] = description

    temp_pdf_path = None

    if document_file:
        print(f"[{datetime.now()}] Document upload: {document_file.filename}")
        kb_id = str(uuid.uuid4())
        chunks_stored = 0
        try:
            file_content = await document_file.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(file_content)
                temp_pdf_path = tmp.name

            text = extract_text_from_pdf(temp_pdf_path)
            if not text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from PDF")

            embedding_api_key = parsed_config.get("embedding_api_key")
            if not embedding_api_key:
                raise HTTPException(status_code=400, detail="embedding_api_key required to process document")

            chunks = split_text_into_chunks(text)
            collection = get_chroma_collection(collection_name="doc_chunks")

            ids, embeddings, docs, metas = [], [], [], []
            for i, chunk in enumerate(chunks):
                try:
                    emb = embed_document_gemini(text_chunk=chunk, api_key=embedding_api_key)
                    ids.append(f"{kb_id}-{i}")
                    embeddings.append(emb)
                    docs.append(chunk)
                    metas.append({
                        "kb_id": kb_id,
                        "workflow_id": workflow_id,
                        "document_name": document_name or document_file.filename,
                        "chunk_index": i,
                    })
                except Exception as e:
                    print(f"[{datetime.now()}] Embed chunk {i} failed: {e}")

            if embeddings:
                collection.add(embeddings=embeddings, documents=docs, metadatas=metas, ids=ids)
                chunks_stored = len(embeddings)

            for node in parsed_nodes:
                if node.get("type") == "knowledgeBaseNode":
                    if "config" not in node:
                        node["config"] = {}
                    node["config"]["kbId"] = kb_id
                    node["config"]["chunksStored"] = chunks_stored
                    node["config"]["uploadedFileName"] = document_name or document_file.filename
        finally:
            if temp_pdf_path and os.path.exists(temp_pdf_path):
                os.remove(temp_pdf_path)

    updates["nodes"] = json.dumps(parsed_nodes)
    
    for key in ("llm_api_key", "embedding_api_key", "serp_api_key"):
        if updates["config"].get(key):
            updates["config"][key] = encrypt(updates["config"][key])

    await db_update_workflow(workflow_id, updates)
    return {"message": "Workflow updated successfully", "workflow_id": workflow_id, "kb_id": kb_id if document_file else None, "chunks_stored": chunks_stored if document_file else 0}


@router.delete("/{workflow_id}")
async def delete_workflow_endpoint(
    workflow_id: str,
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    existing = await get_workflow_by_id(workflow_id)
    if not existing or existing.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Workflow not found")

    deleted = await db_delete_workflow(workflow_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete workflow")
    return {"message": "Workflow deleted successfully"}