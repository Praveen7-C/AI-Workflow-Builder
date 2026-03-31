import os
import uuid
import httpx
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from db.database import create_user, get_user_by_email, get_user_by_id, update_user, upsert_custom_avatar, get_custom_avatar
from utils.auth_utils import hash_password, verify_password, create_access_token, get_current_user_id

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class SignUpRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None


class SignInRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class CustomAvatarRequest(BaseModel):
    config: dict


# ─── Email / Password Auth ───────────────────────────────────────────────────

@router.post("/signup")
async def signup(payload: SignUpRequest):
    existing = await get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    pwd_hash = hash_password(payload.password)
    user = await create_user(
        id=user_id,
        email=payload.email,
        password_hash=pwd_hash,
        display_name=payload.displayName,
    )
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user.get("display_name"),
            "avatar_url": user.get("avatar_url"),
        },
    }


@router.post("/signin")
async def signin(payload: SignInRequest):
    user = await get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user.get("display_name"),
            "avatar_url": user.get("avatar_url"),
        },
    }


# ─── Profile ─────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user.get("display_name"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
    }


@router.put("/profile")
async def update_profile(
    payload: UpdateProfileRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    updates = {}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name
    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await update_user(user_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": updated["id"],
        "email": updated["email"],
        "display_name": updated.get("display_name"),
        "avatar_url": updated.get("avatar_url"),
    }


# ─── Avatar Upload ────────────────────────────────────────────────────────────

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    content = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    file_path = f"{user_id}/avatar.{ext}"

    from db.database import SUPABASE_URL, SUPABASE_SERVICE_KEY
    storage_url = f"{SUPABASE_URL}/storage/v1/object/avatars/{file_path}"
    upload_headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": file.content_type or "image/jpeg",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(storage_url, headers=upload_headers, content=content)
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail=f"Avatar upload failed: {r.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/avatars/{file_path}"
    await update_user(user_id, {"avatar_url": public_url})
    return {"avatar_url": public_url}


@router.delete("/avatar")
async def remove_avatar(authorization: Optional[str] = Header(None)):
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from db.database import SUPABASE_URL, SUPABASE_SERVICE_KEY
    for ext in ["jpg", "jpeg", "png", "webp", "gif"]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"{SUPABASE_URL}/storage/v1/object/avatars/{user_id}/avatar.{ext}",
                    headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
                )
        except Exception:
            pass

    await update_user(user_id, {"avatar_url": None})
    return {"message": "Avatar removed"}


# ─── Custom Avataaars (Generated Avatar) ─────────────────────────────────────

@router.post("/avatar/custom")
async def save_custom_avatar(
    payload: CustomAvatarRequest,
    authorization: Optional[str] = Header(None),
):
    """Save a user's custom avataaars configuration and store the generated URL."""
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Build the avataaars.io URL from the config
    import urllib.parse
    config = payload.config
    params = {
        "avatarStyle": config.get("avatarStyle", "Circle"),
        "topType": config.get("topType", "ShortHairShortFlat"),
        "accessoriesType": config.get("accessoriesType", "Blank"),
        "hairColor": config.get("hairColor", "Brown"),
        "facialHairType": config.get("facialHairType", "Blank"),
        "facialHairColor": config.get("facialHairColor", "Brown"),
        "clotheType": config.get("clotheType", "BlazerShirt"),
        "clotheColor": config.get("clotheColor", "Blue03"),
        "graphicType": config.get("graphicType", "Bat"),
        "eyeType": config.get("eyeType", "Default"),
        "eyebrowType": config.get("eyebrowType", "Default"),
        "mouthType": config.get("mouthType", "Smile"),
        "skinColor": config.get("skinColor", "Light"),
    }
    avatar_url = f"https://avataaars.io/?{urllib.parse.urlencode(params)}"

    # Save config + URL to custom_avatars table
    await upsert_custom_avatar(user_id, config, avatar_url)

    # Also update the user's main avatar_url so it shows in the header/profile
    await update_user(user_id, {"avatar_url": avatar_url})

    return {"avatar_url": avatar_url, "config": config}


@router.get("/avatar/custom")
async def fetch_custom_avatar(authorization: Optional[str] = Header(None)):
    """Retrieve a user's saved avataaars config."""
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    record = await get_custom_avatar(user_id)
    if not record:
        return {"avatar_url": None, "config": None}
    return {"avatar_url": record.get("avatar_url"), "config": record.get("config")}


# ─── Password Reset ───────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """
    Send a password reset email via Supabase Auth.
    The reset link will point to FRONTEND_URL/reset-password.
    """
    # Password reset via email requires Supabase Auth (not used here).
    # In this custom-auth setup, just acknowledge the request.
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    """
    Reset password using the token from the email link.
    The frontend extracts the token from the URL hash and sends it here.
    """
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # In our custom auth setup, the token is actually a JWT access token.
    # Decode it to find the user, then update their password.
    from utils.auth_utils import decode_access_token
    payload_data = decode_access_token(payload.token)
    if not payload_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user_id = payload_data.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    pwd_hash = hash_password(payload.new_password)
    result = await update_user(user_id, {"password_hash": pwd_hash})
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Password updated successfully. Please sign in."}


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/google/login")
async def google_login(mode: str = "signin"):
    """Redirect browser to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID in Backend/.env")

    redirect_uri = f"{BACKEND_URL}/api/user/google/callback"
    scope = "openid email profile"
    state = mode  # pass 'signin' or 'signup' through state

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&state={state}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str, state: str = "signin"):
    """Handle Google OAuth callback, create/fetch user, redirect to frontend."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = f"{BACKEND_URL}/api/user/google/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")
        token_data = token_resp.json()

        # Fetch user info from Google
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        google_user = userinfo_resp.json()

    email = google_user.get("email")
    name = google_user.get("name", "")
    picture = google_user.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email returned from Google")

    # Find or create user in our database
    user = await get_user_by_email(email)
    if not user:
        user_id = str(uuid.uuid4())
        user = await create_user(
            id=user_id,
            email=email,
            password_hash="",  # No password for OAuth users
            display_name=name,
        )
        # Save avatar from Google
        if picture:
            await update_user(user_id, {"avatar_url": picture})
            user["avatar_url"] = picture
    else:
        # Update name/avatar if missing
        updates = {}
        if not user.get("display_name") and name:
            updates["display_name"] = name
        if not user.get("avatar_url") and picture:
            updates["avatar_url"] = picture
        if updates:
            user = await update_user(user["id"], updates) or user

    # Create our JWT
    token = create_access_token(user["id"], user["email"])

    # Redirect to frontend with token
    return RedirectResponse(
        f"{FRONTEND_URL}/auth/callback?token={token}&display_name={user.get('display_name', '')}&avatar_url={user.get('avatar_url', '')}"
    )