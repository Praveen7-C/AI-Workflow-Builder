import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEffect } from "react";
import StacksPage from "./pages/StacksPage";
import BuilderPage from "./pages/BuilderPage";
import Homepage from "./pages/Homepage";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProfilePage from "./pages/ProfilePage";
import AvatarGeneratorPage from "./pages/AvatarGeneratorPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// Handles the redirect from Google OAuth backend
function AuthCallback() {
  const [params] = useSearchParams();
  const { setTokenFromCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    const displayName = params.get("display_name") || undefined;
    const avatarUrl = params.get("avatar_url") || undefined;
    if (token) {
      setTokenFromCallback(token, displayName, avatarUrl);
      navigate("/", { replace: true });
    } else {
      navigate("/auth", { replace: true });
    }
  }, []);

  return <div className="flex h-screen items-center justify-center">Signing in...</div>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
    <Route path="/stacks" element={<ProtectedRoute><StacksPage /></ProtectedRoute>} />
    <Route path="/builder/:id" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/avatar-generator" element={<ProtectedRoute><AvatarGeneratorPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
