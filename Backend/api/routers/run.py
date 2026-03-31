import uuid
from fastapi import APIRouter, HTTPException, Header
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from services.workflow_orchestrator import workflow_orchestrator
from db.database import insert_chat_log, get_chat_logs, get_workflow_by_id
from utils.auth_utils import get_current_user_id

router = APIRouter()


class WorkflowExecuteRequest(BaseModel):
    workflow_id: str
    user_query: str
    conversation_history: Optional[List[Dict[str, str]]] = []


class ChatMessage(BaseModel):
    role: str
    message: str
    timestamp: str


class WorkflowExecuteResponse(BaseModel):
    workflow_response: Dict[str, Any]
    chat_history: List[ChatMessage]


@router.post("/execute", response_model=WorkflowExecuteResponse)
async def execute_workflow_endpoint(
    payload: WorkflowExecuteRequest,
    authorization: Optional[str] = Header(None),
) -> WorkflowExecuteResponse:
    # Validate workflow exists (auth optional for chatbot-style use)
    workflow = await get_workflow_by_id(payload.workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    try:
        workflow_result = await workflow_orchestrator.execute_workflow(
            workflow_id=payload.workflow_id, user_query=payload.user_query
        )
        print(f"[{datetime.now()}] Workflow '{payload.workflow_id}' executed.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{datetime.now()}] CRITICAL ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")

    bot_response_message = workflow_result.get("final_response", "No response generated.")

    # Log user message
    try:
        await insert_chat_log(
            id=str(uuid.uuid4()),
            workflow_id=payload.workflow_id,
            role="user",
            message=payload.user_query,
        )
    except Exception as e:
        print(f"[{datetime.now()}] WARNING: Failed to log user message: {e}")

    # Log bot response
    try:
        await insert_chat_log(
            id=str(uuid.uuid4()),
            workflow_id=payload.workflow_id,
            role="bot",
            message=bot_response_message,
        )
    except Exception as e:
        print(f"[{datetime.now()}] WARNING: Failed to log bot message: {e}")

    # Fetch full chat history
    chat_history_list: List[ChatMessage] = []
    try:
        rows = await get_chat_logs(payload.workflow_id)
        chat_history_list = [
            ChatMessage(role=r["role"], message=r["message"], timestamp=r["timestamp"])
            for r in rows
        ]
    except Exception as e:
        print(f"[{datetime.now()}] WARNING: Failed to fetch chat history: {e}")

    return WorkflowExecuteResponse(
        workflow_response=workflow_result,
        chat_history=chat_history_list,
    )


@router.get("/chat-history/{workflow_id}")
async def get_chat_history(
    workflow_id: str,
    authorization: Optional[str] = Header(None),
):
    """Return full chat history for a workflow."""
    workflow = await get_workflow_by_id(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    rows = await get_chat_logs(workflow_id)
    return [
        {"role": r["role"], "message": r["message"], "timestamp": r["timestamp"]}
        for r in rows
    ]