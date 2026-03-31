import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Workflow, Zap } from "lucide-react";
import { getGoogleAuthUrl } from "@/lib/api";

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
        toast.success("Account created successfully!");
        navigate("/");
      } else {
        await signIn(email, password);
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = getGoogleAuthUrl(isSignUp ? "signup" : "signin");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <img
              src="https://app.aiplanet.com/assets/aiplanet-full-8c667fa2.svg"
              alt="AI Planet"
              className="h-12 brightness-199"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-primary-foreground">GenAI Stack</h1>
          <p className="mb-8 text-lg text-primary-foreground/80">
            Build intelligent workflows visually. Connect LLMs, knowledge bases, and tools — no code required.
          </p>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <Workflow className="h-5 w-5" />
              <span className="text-sm">Visual Builder</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <Zap className="h-5 w-5" />
              <span className="text-sm">AI Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="text-center">
            {/* AI Planet logo shown on mobile or on card */}
            <div className="mb-3 flex justify-center">
              <img
                src="https://app.aiplanet.com/assets/aiplanet-full-8c667fa2.svg"
                alt="AI Planet"
                className="h-8 dark:invert"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <CardTitle className="text-2xl">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>
              {isSignUp ? "Start building AI workflows today" : "Sign in to your GenAI Stack"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google OAuth Button */}
            <Button
              variant="outline"
              className="w-full gap-2 mb-4"
              onClick={handleGoogleAuth}
              type="button"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isSignUp ? "Sign Up with Google" : "Log In with Google"}
            </Button>

            <div className="relative mb-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline font-medium"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
