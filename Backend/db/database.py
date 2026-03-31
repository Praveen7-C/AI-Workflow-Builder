"""
Supabase database layer — uses async httpx directly to Supabase REST API.
Replaces supabase-py which uses a sync httpx client that blocks the async event loop on Windows.
"""

import os
import httpx
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY") or ""


def _headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _rest(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


def init_db():
    print("Using Supabase — ensure schema.sql has been applied to your Supabase project.")


# ─────────────────── Internal async helpers ───────────────────

async def _select(table: str, filters: Dict[str, str]) -> List[Dict]:
    params = {k: f"eq.{v}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(_rest(table), headers=_headers(), params=params)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return r.json()


async def _insert(table: str, data: Dict) -> Dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(_rest(table), headers=_headers(), json=data)
        r.raise_for_status()
        result = r.json()
        return result[0] if isinstance(result, list) else result


async def _update_rows(table: str, filters: Dict[str, str], data: Dict) -> Optional[Dict]:
    params = {k: f"eq.{v}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.patch(_rest(table), headers=_headers(), params=params, json=data)
        r.raise_for_status()
        result = r.json()
        if isinstance(result, list):
            return result[0] if result else None
        return result


async def _delete_rows(table: str, filters: Dict[str, str]) -> bool:
    params = {k: f"eq.{v}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.delete(_rest(table), headers=_headers(), params=params)
        r.raise_for_status()
        result = r.json()
        return isinstance(result, list) and len(result) > 0


# ─────────────────── User operations ───────────────────

async def create_user(id: str, email: str, password_hash: str, display_name: Optional[str] = None) -> Dict:
    return await _insert("users", {
        "id": id,
        "email": email,
        "password_hash": password_hash,
        "display_name": display_name,
    })


async def get_user_by_email(email: str) -> Optional[Dict]:
    results = await _select("users", {"email": email})
    return results[0] if results else None


async def get_user_by_id(user_id: str) -> Optional[Dict]:
    results = await _select("users", {"id": user_id})
    return results[0] if results else None


async def update_user(user_id: str, updates: Dict) -> Optional[Dict]:
    return await _update_rows("users", {"id": user_id}, updates)


# ─────────────────── Workflow operations ───────────────────

async def create_workflow(id: str, user_id: str, name: str, description: str = "") -> Dict:
    return await _insert("workflows", {
        "id": id,
        "user_id": user_id,
        "name": name,
        "description": description,
        "nodes": [],
        "edges": [],
        "config": {},
    })


async def get_workflow_by_id(workflow_id: str) -> Optional[Dict]:
    results = await _select("workflows", {"id": workflow_id})
    return results[0] if results else None


async def list_workflows(user_id: str) -> List[Dict]:
    params = {"user_id": f"eq.{user_id}", "order": "created_at.desc"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(_rest("workflows"), headers=_headers(), params=params)
        r.raise_for_status()
        return r.json() or []


async def update_workflow(workflow_id: str, updates: Dict) -> Optional[Dict]:
    return await _update_rows("workflows", {"id": workflow_id}, updates)


async def delete_workflow(workflow_id: str) -> bool:
    return await _delete_rows("workflows", {"id": workflow_id})


# ─────────────────── Chat log operations ───────────────────

async def insert_chat_log(id: str, workflow_id: str, role: str, message: str) -> Dict:
    result = await _insert("chat_logs", {
        "id": id,
        "workflow_id": workflow_id,
        "role": role,
        "message": message,
    })
    return result or {}


async def get_chat_logs(workflow_id: str) -> List[Dict]:
    params = {"workflow_id": f"eq.{workflow_id}", "order": "timestamp.asc"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(_rest("chat_logs"), headers=_headers(), params=params)
        r.raise_for_status()
        return r.json() or []

# ─────────────────── Custom Avatar (avataaars) operations ───────────────────

async def upsert_custom_avatar(user_id: str, config: Dict, avatar_url: str) -> Dict:
    """Save or update a user's custom avataaars config."""
    try:
        existing = await _select("custom_avatars", {"user_id": user_id})
        if existing:
            return await _update_rows("custom_avatars", {"user_id": user_id}, {
                "config": config,
                "avatar_url": avatar_url,
            }) or existing[0]
        return await _insert("custom_avatars", {
            "user_id": user_id,
            "config": config,
            "avatar_url": avatar_url,
        })
    except Exception:
        return {}


async def get_custom_avatar(user_id: str) -> Optional[Dict]:
    try:
        results = await _select("custom_avatars", {"user_id": user_id})
        return results[0] if results else None
    except Exception:
        return None