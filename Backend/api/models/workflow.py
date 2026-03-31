from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class WorkflowConfig(BaseModel):
    prompt: Optional[str] = "Use the context to answer the query."
    llm_api_key: Optional[str] = None
    embedding_api_key: Optional[str] = None
    serp_api_key: Optional[str] = None
    web_search_enabled: Optional[bool] = False
    web_search_results: Optional[int] = 3
    temperature: Optional[float] = 0.7


class WorkflowCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None



# This model is kept here for documentation/type-hint purposes only.
class WorkflowUpdateRequest(BaseModel):
    workflow_id: str
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    config: Optional[WorkflowConfig] = None
