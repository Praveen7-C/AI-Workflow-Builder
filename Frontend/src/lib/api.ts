const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function signUp(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  return request("/api/user/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  return request("/api/user/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut(): Promise<void> {
  return Promise.resolve();
}

export async function getProfile(token: string): Promise<AuthUser> {
  const data = await request<any>("/api/user/profile", {}, token);
  return {
    id: data.id,
    email: data.email,
    display_name: data.display_name || data.full_name,
    avatar_url: data.avatar_url,
  };
}

export async function updateProfile(
  token: string,
  updates: { display_name?: string; avatar_url?: string | null }
): Promise<AuthUser> {
  return request<AuthUser>("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(updates),
  }, token);
}

export async function uploadAvatar(token: string, file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/user/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Avatar upload failed");
  }
  return res.json();
}

export async function removeAvatar(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/user/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveCustomAvatar(
  token: string,
  config: Record<string, string>
): Promise<{ avatar_url: string; config: Record<string, string> }> {
  return request<{ avatar_url: string; config: Record<string, string> }>(
    "/api/user/avatar/custom",
    {
      method: "POST",
      body: JSON.stringify({ config }),
    },
    token
  );
}

export async function getCustomAvatar(
  token: string
): Promise<{ avatar_url: string | null; config: Record<string, string> | null }> {
  return request<{ avatar_url: string | null; config: Record<string, string> | null }>(
    "/api/user/avatar/custom",
    {},
    token
  );
}

export async function forgotPassword(email: string): Promise<void> {
  return request("/api/user/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, new_password: string): Promise<void> {
  return request("/api/user/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });
}

export function getGoogleAuthUrl(mode: "signin" | "signup"): string {
  return `${API_BASE_URL}/api/user/google/login?mode=${mode}`;
}
