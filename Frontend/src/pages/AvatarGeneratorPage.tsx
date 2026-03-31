import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { saveCustomAvatar, getCustomAvatar } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Save, Shuffle } from "lucide-react";
import Header from "@/components/Header";

// ─── Avataaars option sets ───────────────────────────────────────────────────

const AVATAR_OPTIONS = {
  topType: {
    label: "Hair / Top",
    values: [
      "NoHair", "Eyepatch", "Hat", "Hijab", "Turban",
      "WinterHat1", "WinterHat2", "WinterHat3", "WinterHat4",
      "LongHairBigHair", "LongHairBob", "LongHairBun", "LongHairCurly",
      "LongHairCurvy", "LongHairDreads", "LongHairFrida", "LongHairFro",
      "LongHairFroBand", "LongHairNotTooLong", "LongHairShavedSides",
      "LongHairMiaWallace", "LongHairStraight", "LongHairStraight2",
      "LongHairStraightStrand", "ShortHairDreads01", "ShortHairDreads02",
      "ShortHairFrizzle", "ShortHairShaggyMullet", "ShortHairShortCurly",
      "ShortHairShortFlat", "ShortHairShortRound", "ShortHairShortWaved",
      "ShortHairSides", "ShortHairTheCaesar", "ShortHairTheCaesarSidePart",
    ],
  },
  accessoriesType: {
    label: "Accessories",
    values: [
      "Blank", "Kurt", "Prescription01", "Prescription02",
      "Round", "Sunglasses", "Wayfarers",
    ],
  },
  hairColor: {
    label: "Hair Color",
    values: [
      "Auburn", "Black", "Blonde", "BlondeGolden", "Brown",
      "BrownDark", "PastelPink", "Platinum", "Red", "SilverGray",
    ],
  },
  facialHairType: {
    label: "Facial Hair",
    values: [
      "Blank", "BeardMedium", "BeardLight", "BeardMagestic",
      "MoustacheFancy", "MoustacheMagnum",
    ],
  },
  facialHairColor: {
    label: "Facial Hair Color",
    values: [
      "Auburn", "Black", "Blonde", "BlondeGolden", "Brown",
      "BrownDark", "Platinum", "Red",
    ],
  },
  clotheType: {
    label: "Clothes",
    values: [
      "BlazerShirt", "BlazerSweater", "CollarSweater", "GraphicShirt",
      "Hoodie", "Overall", "ShirtCrewNeck", "ShirtScoopNeck",
      "ShirtVNeck",
    ],
  },
  clotheColor: {
    label: "Clothes Color",
    values: [
      "Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02",
      "Heather", "PastelBlue", "PastelGreen", "PastelOrange",
      "PastelRed", "PastelYellow", "Pink", "Red", "White",
    ],
  },
  graphicType: {
    label: "Graphic (Shirt)",
    values: [
      "Bat", "Cumbia", "Deer", "Diamond", "Hola", "Pizza",
      "Resist", "Selena", "Bear", "SkullOutline", "Skull",
    ],
  },
  eyeType: {
    label: "Eyes",
    values: [
      "Close", "Cry", "Default", "Dizzy", "EyeRoll", "Happy",
      "Hearts", "Side", "Squint", "Surprised", "Wink", "WinkWacky",
    ],
  },
  eyebrowType: {
    label: "Eyebrows",
    values: [
      "Angry", "AngryNatural", "Default", "DefaultNatural",
      "FlatNatural", "RaisedExcited", "RaisedExcitedNatural",
      "SadConcerned", "SadConcernedNatural", "UnibrowNatural", "UpDown",
      "UpDownNatural",
    ],
  },
  mouthType: {
    label: "Mouth",
    values: [
      "Concerned", "Default", "Disbelief", "Eating", "Grimace",
      "Sad", "ScreamOpen", "Serious", "Smile", "Tongue", "Twinkle",
      "Vomit",
    ],
  },
  skinColor: {
    label: "Skin Color",
    values: [
      "Tanned", "Yellow", "Pale", "Light", "Brown",
      "DarkBrown", "Black",
    ],
  },
};

type AvatarConfig = { [K in keyof typeof AVATAR_OPTIONS]: string } & {
  avatarStyle?: string;
};

function buildAvatarUrl(config: AvatarConfig): string {
  const params = new URLSearchParams({
    avatarStyle: config.avatarStyle || "Circle",
    topType: config.topType || "ShortHairShortFlat",
    accessoriesType: config.accessoriesType || "Blank",
    hairColor: config.hairColor || "Brown",
    facialHairType: config.facialHairType || "Blank",
    facialHairColor: config.facialHairColor || "Brown",
    clotheType: config.clotheType || "BlazerShirt",
    clotheColor: config.clotheColor || "Blue03",
    graphicType: config.graphicType || "Bat",
    eyeType: config.eyeType || "Default",
    eyebrowType: config.eyebrowType || "Default",
    mouthType: config.mouthType || "Smile",
    skinColor: config.skinColor || "Light",
  });
  return `https://avataaars.io/?${params.toString()}`;
}

function randomConfig(): AvatarConfig {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return Object.fromEntries(
    Object.entries(AVATAR_OPTIONS).map(([key, { values }]) => [key, pick(values)])
  ) as AvatarConfig;
}

const DEFAULT_CONFIG: AvatarConfig = {
  topType: "ShortHairShortFlat",
  accessoriesType: "Blank",
  hairColor: "Brown",
  facialHairType: "Blank",
  facialHairColor: "Brown",
  clotheType: "BlazerShirt",
  clotheColor: "Blue03",
  graphicType: "Bat",
  eyeType: "Default",
  eyebrowType: "Default",
  mouthType: "Smile",
  skinColor: "Light",
  avatarStyle: "Circle",
};

// ─── Option Selector Component ───────────────────────────────────────────────

function OptionSelector({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150 ${
              value === opt
                ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                : "bg-background border-border hover:border-primary/60 hover:bg-primary/5 text-foreground"
            }`}
          >
            {opt.replace(/([A-Z0-9])/g, " $1").trim()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AvatarGeneratorPage() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarStyle, setAvatarStyle] = useState<"Circle" | "Transparent">("Circle");

  // Load existing custom avatar config
  useEffect(() => {
    if (!session?.access_token) return;
    getCustomAvatar(session.access_token)
      .then((data) => {
        if (data?.config) {
          setConfig({ ...DEFAULT_CONFIG, ...data.config });
          if (data.config.avatarStyle) setAvatarStyle(data.config.avatarStyle as any);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const update = useCallback((key: keyof AvatarConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleShuffle = () => {
    const rc = randomConfig();
    setConfig({ ...rc, avatarStyle });
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG, avatarStyle });
  };

  const currentConfig = { ...config, avatarStyle };
  const previewUrl = buildAvatarUrl(currentConfig);

  const handleSave = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      await saveCustomAvatar(session.access_token, currentConfig);
      await refreshProfile();
      toast.success("Avatar saved! It now appears on your profile.");
      setTimeout(() => navigate("/profile"), 800);
    } catch (err: any) {
      toast.error(err.message || "Failed to save avatar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Loading your avatar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-6 md:px-8">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Design Your Avatar</h1>
            <p className="text-sm text-muted-foreground">
              Customize your personal avatar — it'll appear on your profile and header
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Preview Panel */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Avatar preview"
                      className="w-40 h-40 rounded-full ring-4 ring-primary/20 shadow-lg transition-all duration-300"
                      key={previewUrl}
                    />
                  </div>

                  {/* Avatar style toggle */}
                  <div className="w-full space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Frame Style
                    </Label>
                    <div className="flex gap-2">
                      {(["Circle", "Transparent"] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => setAvatarStyle(style)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                            avatarStyle === style
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary/60"
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex w-full gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={handleShuffle}
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Shuffle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={handleReset}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Avatar"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Customization Panel */}
          <div className="flex-1 space-y-4">
            {(Object.entries(AVATAR_OPTIONS) as [keyof typeof AVATAR_OPTIONS, { label: string; values: string[] }][]).map(
              ([key, { label, values }]) => (
                <Card key={key} className="border-border">
                  <CardContent className="pt-4">
                    <OptionSelector
                      label={label}
                      options={values}
                      value={config[key] || values[0]}
                      onChange={(v) => update(key, v)}
                    />
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
