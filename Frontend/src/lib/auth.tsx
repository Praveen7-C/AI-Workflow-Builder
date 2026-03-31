import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import * as api from "./api";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  session: { access_token: string } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setTokenFromCallback: (token: string, displayName?: string, avatarUrl?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (token: string) => {
    try {
      const profileData = await api.getProfile(token);
      setProfile({
        id: profileData.id,
        user_id: profileData.id,
        display_name: profileData.display_name || null,
        email: profileData.email,
        avatar_url: profileData.avatar_url || null,
      });
    } catch (e) {
      console.warn("Backend profile fetch failed:", e);
      setProfile(null);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) {
      try {
        const decoded = jwtDecode<{ sub: string; email: string }>(storedToken);
        setUser({ id: decoded.sub, email: decoded.email });
        setSession({ access_token: storedToken });
        fetchProfile(storedToken);
      } catch (error) {
        localStorage.removeItem("access_token");
      }
    }
    setLoading(false);
  }, []);

  const _applyAuthResponse = (response: api.AuthResponse) => {
    localStorage.setItem("access_token", response.access_token);
    setSession({ access_token: response.access_token });
    setUser({ id: response.user.id, email: response.user.email });
    setProfile({
      id: response.user.id,
      user_id: response.user.id,
      display_name: response.user.display_name || null,
      email: response.user.email,
      avatar_url: response.user.avatar_url || null,
    });
  };

  const signIn = async (email: string, password: string) => {
    const response = await api.signIn(email, password);
    _applyAuthResponse(response);
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const response = await api.signUp(email, password, displayName);
    _applyAuthResponse(response);
  };

  const signOut = async () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  // Called after Google OAuth callback
  const setTokenFromCallback = (token: string, displayName?: string, avatarUrl?: string) => {
    localStorage.setItem("access_token", token);
    try {
      const decoded = jwtDecode<{ sub: string; email: string }>(token);
      setUser({ id: decoded.sub, email: decoded.email });
      setSession({ access_token: token });
      setProfile({
        id: decoded.sub,
        user_id: decoded.sub,
        display_name: displayName || null,
        email: decoded.email,
        avatar_url: avatarUrl || null,
      });
    } catch (e) {
      console.error("Failed to decode token from callback", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile, setTokenFromCallback }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
