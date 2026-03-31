import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { updateProfile, uploadAvatar, removeAvatar, getCustomAvatar } from "@/lib/api";
import { toast } from "sonner";
import { Camera, ArrowLeft, Save, Trash2, Sparkles, Upload, User } from "lucide-react";
import Header from "@/components/Header";

export default function ProfilePage() {
  const { user, profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (!session?.access_token) return;
    getCustomAvatar(session.access_token)
      .then((data) => setHasCustomAvatar(!!data?.config))
      .catch(() => {});
  }, [session]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;
    setUploading(true);
    try {
      const result = await uploadAvatar(session.access_token, file);
      setAvatarUrl(result.avatar_url + `?t=${Date.now()}`);
      await refreshProfile();
      toast.success("Profile photo uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!session?.access_token) return;
    try {
      await removeAvatar(session.access_token);
      setAvatarUrl(null);
      setHasCustomAvatar(false);
      await refreshProfile();
      toast.success("Avatar removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove avatar");
    }
  };

  const handleSave = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      await updateProfile(session.access_token, {
        display_name: displayName,
        avatar_url: avatarUrl,
      });
      await refreshProfile();
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = displayName
    ? displayName.charAt(0).toUpperCase()
    : profile?.email?.charAt(0).toUpperCase() || "U";

  const userEmail = profile?.email || user?.email || "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-start justify-center px-6 py-10">
        <Card className="w-full max-w-lg border-border shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
               <Button variant="ghost" size="icon" onClick={() => navigate("/stacks")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle>Edit Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div
                  className="cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-28 w-28 ring-4 ring-border shadow-md">
                    <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-7 w-7 text-white" />
                  </div>
                </div>
                {hasCustomAvatar && (
                  <Badge
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0.5 gap-1"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    Custom
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {uploading
                  ? "Uploading..."
                  : avatarUrl
                  ? "Click avatar to change photo"
                  : "No avatar set — your initials are showing"}
              </p>

              <div className="flex flex-col w-full gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => navigate("/avatar-generator")}
                >
                  <Sparkles className="h-4 w-4" />
                  Design My Avataaars
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </Button>

                  {avatarUrl && (
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive hover:border-destructive"
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />

              <div className="flex items-start gap-2 w-full rounded-lg bg-muted/50 px-3 py-2.5 border border-border/50">
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {avatarUrl
                    ? "Your avatar is linked to your email and shown across the app."
                    : 'Use "Design My Avataaars" to build a fun custom avatar, or upload your own photo. Without either, your initials will be shown.'}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={userEmail}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full gap-2" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
