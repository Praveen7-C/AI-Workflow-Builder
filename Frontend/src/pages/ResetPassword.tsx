import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Token can come from URL hash (Supabase email link) or search params
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const accessToken = hashParams.get("access_token") || searchParams.get("token");
    if (accessToken) {
      setToken(accessToken);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated! Please sign in.");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Invalid or expired reset link.</p>
            <Button onClick={() => navigate("/auth")}>Back to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-3 flex justify-center">
            <img
              src="https://app.aiplanet.com/assets/aiplanet-full-8c667fa2.svg"
              alt="AI Planet"
              className="h-8 dark:invert"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
