# services/workflow_orchestrator.py
import json
from datetime import datetime
from fastapi import HTTPException
from utils.encryption import decrypt
from typing import Dict, Any, Set

from services.nodes.user_query_node    import process_query              as user_query_processor
from services.nodes.knowledge_base_node import process_knowledge_retrieval as knowledge_base_processor
from services.nodes.llm_engine_node    import generate_response           as llm_engine_processor
from services.nodes.output_node        import process_output              as output_processor
from services.nodes.web_search_node    import process_web_search          as web_search_processor
from db.database import get_workflow_by_id


class WorkflowOrchestrator:
    def __init__(self):
        self.node_map = {
            "userQueryNode":     user_query_processor,
            "knowledgeBaseNode": knowledge_base_processor,
            "llmNode":           llm_engine_processor,
            "outputNode":        output_processor,
            "webSearchNode":     web_search_processor,
        }

    async def execute_workflow(self, workflow_id: str, user_query: str) -> Dict[str, Any]:
        print(f"[{datetime.now()}] Workflow START  id={workflow_id}  query='{user_query}'")

        # Load workflow
        workflow_data = await get_workflow_by_id(workflow_id)
        if not workflow_data:
            raise HTTPException(status_code=404, detail="Workflow not found.")

        nodes_data  = workflow_data.get("nodes", [])
        edges_data  = workflow_data.get("edges", [])
        config_data = workflow_data.get("config", {})

        # Supabase may return JSONB columns as raw JSON strings — parse all three.
        # Also handle the case where each list *element* is itself a JSON string
        # (double-encoded), which causes "string indices must be integers" when
        # code later does node["id"] on a plain string.
        def _parse_jsonb_list(value, default):
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except Exception:
                    return default
            if not isinstance(value, list):
                return default
            result = []
            for item in value:
                if isinstance(item, str):
                    try:
                        item = json.loads(item)
                    except Exception:
                        continue
                if isinstance(item, dict):
                    result.append(item)
            return result

        def _parse_jsonb_dict(value, default):
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except Exception:
                    return default
            return value if isinstance(value, dict) else default

        nodes_data  = _parse_jsonb_list(nodes_data,  [])
        edges_data  = _parse_jsonb_list(edges_data,  [])
        config_data = _parse_jsonb_dict(config_data, {})

        # Decrypt API keys─
        decrypted_config = dict(config_data)
        for key in ("llm_api_key", "embedding_api_key", "serp_api_key"):
            if decrypted_config.get(key):
                try:
                    decrypted_config[key] = decrypt(decrypted_config[key])
                except Exception as exc:
                    print(f"[{datetime.now()}] Failed to decrypt '{key}': {exc}")
                    decrypted_config[key] = None

        # Build valid node-ID set (used to filter ghost edges)─
        valid_node_ids: Set[str] = {node["id"] for node in nodes_data}

        # Build adjacency list — SKIP ghost edges
        adj: Dict[str, list] = {node["id"]: [] for node in nodes_data}
        ghost_count = 0
        for edge in edges_data:
            if not isinstance(edge, dict):
                continue
            src, tgt = edge.get("source"), edge.get("target")
            if not src or not tgt:
                continue
            if tgt not in valid_node_ids:
                # FIX #1: ghost edge — target node was deleted; skip silently
                print(f"[{datetime.now()}] WARNING: skipping ghost edge {edge.get('id','')} → '{tgt}' (node not found)")
                ghost_count += 1
                continue
            if src in adj:
                adj[src].append({
                    "target":       tgt,
                    "sourceHandle": edge.get("sourceHandle"),
                    "targetHandle": edge.get("targetHandle"),
                })
        if ghost_count:
            print(f"[{datetime.now()}] Skipped {ghost_count} ghost edge(s).")

        # Find start node
        start_id = next(
            (n["id"] for n in nodes_data if n.get("type") == "userQueryNode"), None
        )
        if not start_id:
            raise HTTPException(status_code=400, detail="Workflow must have a 'User Query' node.")

        # Execute loop─
        current_inputs: Dict[str, Any] = {"query": user_query}
        current_id   = start_id
        all_outputs: Dict[str, Dict[str, Any]] = {}
        visited: Set[str] = set()
        final_response_data = None

        while current_id:
            if current_id in visited:
                print(f"[{datetime.now()}] Cycle detected at '{current_id}' — stopping.")
                break
            visited.add(current_id)

            node_info = next((n for n in nodes_data if n["id"] == current_id), None)
            if not node_info:
                # Should never happen now (ghost edges filtered), but be safe
                print(f"[{datetime.now()}] Node '{current_id}' not found — stopping.")
                break

            node_type   = node_info.get("type")
            node_config = node_info.get("config", {}) or {}
            if isinstance(node_config, str):
                try:
                    node_config = json.loads(node_config)
                except Exception:
                    node_config = {}

            if node_type not in self.node_map:
                raise HTTPException(status_code=501, detail=f"Node type '{node_type}' not implemented.")

            print(f"[{datetime.now()}] Executing '{node_type}'  (id={current_id})")

            # Execute node─
            node_output: Dict[str, Any] = {}
            try:
                if node_type == "userQueryNode":
                    node_output = await user_query_processor(query=current_inputs["query"])

                elif node_type == "knowledgeBaseNode":
                    embedding_api_key = node_config.get("apiKey") or decrypted_config.get("embedding_api_key")
                    embedding_model   = node_config.get("embeddingModel") or "gemini-embedding-001"
                    kb_wf_id          = node_config.get("kbId") or workflow_id

                    if not embedding_api_key:
                        raise ValueError("KnowledgeBaseNode requires an embedding API key.")

                    print(f"[{datetime.now()}] KB: kbId='{kb_wf_id}' model='{embedding_model}'")
                    node_output = await knowledge_base_processor(
                        query             = current_inputs["query"],
                        workflow_id       = kb_wf_id,
                        embedding_api_key = embedding_api_key,
                        embedding_model   = embedding_model,
                    )
                    current_inputs["context"] = node_output.get("context", "")
                    print(f"[{datetime.now()}] KB context length: {len(current_inputs['context'])}")

                elif node_type == "llmNode":
                    llm_api_key   = node_config.get("apiKey")     or decrypted_config.get("llm_api_key")
                    serp_api_key  = node_config.get("serpApiKey") or decrypted_config.get("serp_api_key")
                    web_search_on = node_config.get("webSearchEnabled") or config_data.get("web_search_enabled", False)
                    model_name    = node_config.get("model") or config_data.get("model", "gemini-2.5-flash-preview-04-17")
                    temperature   = float(node_config.get("temperature") or config_data.get("temperature", 0.7))
                    custom_prompt = node_config.get("prompt")

                    if not llm_api_key and not (web_search_on and serp_api_key):
                        raise ValueError("LLMNode requires an LLM API key when web search is disabled.")

                    node_output = await llm_engine_processor(
                        query              = current_inputs["query"],
                        context            = current_inputs.get("context"),
                        custom_prompt      = custom_prompt,
                        model_name         = model_name,
                        llm_api_key        = llm_api_key,
                        serp_api_key       = serp_api_key,
                        web_search_enabled = web_search_on,
                        temperature        = temperature,
                    )
                    # FIX #2: store response under BOTH keys so output_node and
                    # edge propagation both find it regardless of key name used.
                    llm_text = node_output.get("response", "")
                    current_inputs["llm_response"] = llm_text
                    current_inputs["response"]     = llm_text

                elif node_type == "outputNode":
                    node_output         = await output_processor(input_data=current_inputs)
                    final_response_data = node_output

                elif node_type == "webSearchNode":
                    serp_api_key = node_config.get("serpApiKey") or decrypted_config.get("serp_api_key")
                    if not serp_api_key:
                        raise ValueError("WebSearchNode requires a SerpAPI key.")
                    node_output = await web_search_processor(
                        query        = current_inputs.get("query") or current_inputs.get("llm_response", ""),
                        serp_api_key = serp_api_key,
                    )
                    current_inputs["web_search_results"] = node_output.get("formatted_results", "")

            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Error in node '{node_type}': {exc}") from exc
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Error in node '{node_type}': {exc}") from exc

            all_outputs[current_id] = node_output

            # Edge traversal─
            # FIX #3: try all outgoing edges and pick first one whose target
            # hasn't been visited yet (ghost edges already removed above).
            next_edges = adj.get(current_id, [])
            next_id    = None

            for edge in next_edges:
                candidate = edge["target"]
                if candidate not in visited:
                    next_id = candidate
                    # Propagate output into next node's inputs
                    target_handle = edge.get("targetHandle", "") or ""

                    if target_handle == "context" and "context" in node_output:
                        current_inputs["context"] = node_output["context"]
                    elif target_handle == "query" and "response" in node_output:
                        current_inputs["query"] = node_output["response"]
                    elif target_handle == "query" and "query" in node_output:
                        current_inputs["query"] = node_output["query"]
                    elif target_handle == "target":
                        # FIX #2 cont.: propagate "response" as BOTH response AND llm_response
                        if "response" in node_output:
                            current_inputs["response"]     = node_output["response"]
                            current_inputs["llm_response"] = node_output["response"]
                        for k in ("context", "query", "formatted_results"):
                            if k in node_output:
                                current_inputs[k] = node_output[k]
                    else:
                        current_inputs.update(node_output)
                    break   # take first valid edge only

            current_id = next_id

        print(f"[{datetime.now()}] Workflow END  id={workflow_id}")
        return final_response_data or {"message": "Workflow completed with no final output node."}


workflow_orchestrator = WorkflowOrchestrator()
