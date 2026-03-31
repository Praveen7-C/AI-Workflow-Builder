import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { forgotPassword } from "@/lib/api";

export default function ForgotPassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success("Password reset link sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setSubmitting(false);
    }
  };

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
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {sent
              ? "Check your email for a password reset link"
              : "Enter your email to receive a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a reset link to <strong>{email}</strong>. Please check your inbox.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate("/auth")}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
