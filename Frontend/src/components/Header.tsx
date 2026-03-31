import { useNavigate, useLocation } from "react-router-dom";
import { Save, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

interface HeaderProps {
  onSave?: () => void;
}

const Header = ({ onSave }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const isBuilder = location.pathname.startsWith("/builder");
  const isStacks = location.pathname.startsWith("/stacks");

  const handleLogoClick = () => {
    if (isBuilder) navigate("/stacks");
    else if (isStacks) navigate("/");
    else navigate("/");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName =
    profile?.display_name ||
    (user as any)?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "User";
  const email = profile?.email || user?.email || "";
  const avatarUrl = profile?.avatar_url || null;

  const initials = displayName.charAt(0).toUpperCase();
  const isDark = theme === "dark";

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={handleLogoClick}
      >
        <img
          src="https://app.aiplanet.com/assets/aiplanet-full-8c667fa2.svg"
          alt="AI Planet"
          className="h-7 dark:invert"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
            img.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <span className="text-sm font-semibold hidden">GenAI Stack</span>
      </div>

      <div className="flex items-center gap-3">
        {isBuilder && onSave && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>
              </div>

              {/* Edit Profile */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => navigate("/profile")}
              >
                <UserRound className="h-4 w-4" />
                Edit Profile
              </Button>

              {/* Theme toggle */}
              <div className="flex items-center justify-between py-2 border-t border-b">
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">Theme</span>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={() => setTheme(isDark ? "light" : "dark")}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default Header;