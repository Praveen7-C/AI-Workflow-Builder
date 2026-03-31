/**
 * Backend API client — all calls go to the FastAPI backend at VITE_BACKEND_URL.
 * This file maintains the `supabase` export name for compatibility with existing code.
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...(options.headers as Record<string, string> || {}),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: { message: errorData.detail || `HTTP ${response.status}` } };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || "Network error" } };
  }
}

// Auth interface (mirrors Supabase auth shape for compatibility)
const auth = {
  getSession: async () => {
    const token = getToken();
    return {
      data: {
        session: token
          ? { access_token: token, user: { id: "local", email: "" } }
          : null,
      },
      error: null,
    };
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    const token = getToken();
    if (token) {
      callback("SIGNED_IN", { access_token: token });
    } else {
      callback("SIGNED_OUT", null);
    }
    return { data: { subscription: { unsubscribe: () => {} } } };
  },

  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/api/user/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { data: { user: null, session: null }, error: { message: error.detail || "Sign in failed" } };
    }
    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    return {
      data: {
        user: { id: data.user.id, email: data.user.email },
        session: { access_token: data.access_token },
      },
      error: null,
    };
  },

  signUp: async ({ email, password, options }: { email: string; password: string; options?: any }) => {
    const response = await fetch(`${API_BASE_URL}/api/user/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: options?.data?.display_name }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { data: { user: null, session: null }, error: { message: error.detail || "Sign up failed" } };
    }
    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    return {
      data: {
        user: { id: data.user.id, email: data.user.email },
        session: { access_token: data.access_token },
      },
      error: null,
    };
  },

  signOut: async () => {
    localStorage.removeItem("access_token");
    return { error: null };
  },

  updateUser: async ({ password }: { password: string }) => {
    const token = getToken();
    if (!token) return { error: { message: "Not authenticated" } };
    const res = await fetch(`${API_BASE_URL}/api/user/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token, new_password: password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: { message: err.detail || "Update failed" } };
    }
    return { error: null };
  },

  resetPasswordForEmail: async (email: string, options?: any) => {
    const res = await fetch(`${API_BASE_URL}/api/user/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return { error: { message: "Failed" } };
    return { error: null };
  },
};

// Table query builder
function fromTable(table: string) {
  let _filters: Record<string, any> = {};

  const buildQuery = async () => {
    if (table === "chat_logs" && _filters["workflow_id"]) {
      const res = await apiRequest<any[]>(`/api/chat-history/${_filters["workflow_id"]}`);
      if (res.error) return { data: null, error: res.error };
      const mapped = (res.data || []).map((r: any) => ({
        role: r.role,
        content: r.message,
        created_at: r.timestamp,
      }));
      return { data: mapped, error: null };
    }
    return { data: [], error: null };
  };

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => { _filters[col] = val; return builder; },
    order: () => builder,
    limit: () => builder,
    single: () => ({
      then: (resolve: any) => buildQuery().then((r) => resolve({ data: r.data?.[0] || null, error: r.error })),
    }),
  };

  Object.defineProperty(builder, "then", {
    get() {
      return (resolve: any, reject: any) => buildQuery().then(resolve, reject);
    },
  });

  return builder;
}

// Storage stub (actual uploads go through backend)
const storage = {
  from: (_bucket: string) => ({
    upload: async () => ({ error: null }),
    update: async () => ({ error: null }),
    remove: async () => ({ error: null }),
    getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
  }),
};

export const supabase = { auth, from: fromTable, storage };

export type Database = any;
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
