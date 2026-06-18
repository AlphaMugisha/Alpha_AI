"use client";

import { useState, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/app/actions/profile";
import { AIProvider } from "@/types";
import { toast } from "sonner";
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Check,
  Trash2,
  ExternalLink,
  Shield,
  Moon,
  Sun,
  Monitor,
  Bell,
  Clock,
  GraduationCap,
  AlertCircle,
  Save,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { GithubSettings } from "@/components/github/GithubSettings";

const PROVIDERS = [
  {
    id: "gemini" as AIProvider,
    name: "Google Gemini",
    model: "gemini-2.5-flash",
    logo: "✦",
    color: "from-blue-500 to-cyan-500",
    keyHint: "Get a free key at aistudio.google.com",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai" as AIProvider,
    name: "OpenAI GPT",
    model: "gpt-4o-mini",
    logo: "◆",
    color: "from-green-500 to-emerald-600",
    keyHint: "Get a key at platform.openai.com",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic" as AIProvider,
    name: "Anthropic Claude",
    model: "claude-opus-4-8",
    logo: "✱",
    color: "from-orange-500 to-amber-600",
    keyHint: "Get a key at console.anthropic.com (Claude Pro ≠ API access)",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "groq" as AIProvider,
    name: "Groq (Free)",
    model: "llama-3.3-70b-versatile",
    logo: "⚡",
    color: "from-rose-500 to-pink-600",
    keyHint: "Get a FREE key at console.groq.com — no credit card needed",
    keyUrl: "https://console.groq.com/keys",
  },
];

function APIKeySection({
  provider,
  savedKey,
  onSave,
  onRemove,
}: {
  provider: (typeof PROVIDERS)[number];
  savedKey: string;
  onSave: (key: string) => void;
  onRemove: () => void;
}) {
  const [input, setInput] = useState(savedKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasKey = savedKey.trim().length > 0;

  const handleSave = () => {
    if (!input.trim()) { toast.error("Please enter an API key."); return; }
    onSave(input.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success(`${provider.name} API key saved!`);
  };

  const handleRemove = () => {
    onRemove();
    setInput("");
    toast.success(`${provider.name} API key removed.`);
  };

  const masked = savedKey
    ? savedKey.slice(0, 6) + "••••••••" + savedKey.slice(-4)
    : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold", provider.color)}>
            {provider.logo}
          </div>
          <span className="font-medium text-sm">{provider.name}</span>
          <span className="text-xs text-muted-foreground">· {provider.model}</span>
        </div>
        {hasKey ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-xs">
            <Check className="w-3 h-3 mr-1" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="border-muted text-muted-foreground text-xs">
            Not set
          </Badge>
        )}
      </div>

      {hasKey && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs font-mono text-muted-foreground">
          <Key className="w-3 h-3 shrink-0" />
          {masked}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            placeholder={hasKey ? "Enter new key to update..." : "Paste your API key here..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="pr-10 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button
          onClick={handleSave}
          size="sm"
          className={cn(saved ? "bg-green-600 hover:bg-green-700" : "")}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        </Button>
        {hasKey && (
          <Button size="sm" variant="outline" onClick={handleRemove} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <a
        href={provider.keyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="w-3 h-3" /> {provider.keyHint}
      </a>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, hasGeminiKey, hasOpenAIKey, hasAnthropicKey, aiConfig } = useSettings();
  const { user, refreshProfile } = useAuth();
  const { setTheme } = useTheme();
  const [, startTransition] = useTransition();

  const syncToCloud = (data: Parameters<typeof updateProfile>[0]) => {
    if (!user) return;
    startTransition(async () => {
      await updateProfile(data);
      await refreshProfile();
    });
  };

  const activeProvider = PROVIDERS.find(p => p.id === aiConfig.provider)!;

  const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Configure your AI providers and preferences"
        icon={<Settings className="w-5 h-5" />}
      />

      <div className="max-w-2xl mx-auto space-y-6">

        {/* Active provider banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border",
            "bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200",
            "dark:from-violet-950/20 dark:to-indigo-950/20 dark:border-violet-800"
          )}
        >
          <Zap className="w-4 h-4 text-violet-500 shrink-0" />
          <p className="text-sm flex-1">
            <span className="text-muted-foreground">Currently using </span>
            <span className="font-semibold text-violet-700 dark:text-violet-400">{activeProvider.name}</span>
            <span className="text-muted-foreground"> · {activeProvider.model}</span>
          </p>
          {!aiConfig.apiKey && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> No key set
            </span>
          )}
        </motion.div>

        {/* AI Provider switcher */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Provider</CardTitle>
              <CardDescription>
                Switch between providers instantly. Both keys are saved — just toggle between them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider selector cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PROVIDERS.map((p) => {
                  const isActive = settings.aiProvider === p.id;
                  const hasKey =
                    p.id === "gemini"
                      ? hasGeminiKey
                      : p.id === "openai"
                        ? hasOpenAIKey
                        : p.id === "anthropic"
                          ? hasAnthropicKey
                          : hasGroqKey;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        updateSettings({ aiProvider: p.id });
                        syncToCloud({ ai_provider: p.id });
                        toast.success(`Switched to ${p.name}`);
                      }}
                      className={cn(
                        "relative p-4 rounded-xl border-2 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-base font-bold mb-3", p.color)}>
                        {p.logo}
                      </div>
                      <div className="font-semibold text-sm mb-0.5">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.model}</div>
                      <div className="mt-2">
                        {hasKey ? (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Key saved
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No key yet</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Separator />

              {/* API key sections for both providers */}
              <div className="space-y-5">
                <APIKeySection
                  provider={PROVIDERS[0]}
                  savedKey={settings.geminiApiKey || ""}
                  onSave={(key) => {
                    updateSettings({ geminiApiKey: key });
                    syncToCloud({ gemini_api_key: key });
                  }}
                  onRemove={() => {
                    updateSettings({ geminiApiKey: "" });
                    syncToCloud({ gemini_api_key: "" });
                  }}
                />
                <Separator />
                <APIKeySection
                  provider={PROVIDERS[1]}
                  savedKey={settings.openaiApiKey || ""}
                  onSave={(key) => {
                    updateSettings({ openaiApiKey: key });
                    syncToCloud({ openai_api_key: key });
                  }}
                  onRemove={() => {
                    updateSettings({ openaiApiKey: "" });
                    syncToCloud({ openai_api_key: "" });
                  }}
                />
                <Separator />
                <APIKeySection
                  provider={PROVIDERS[2]}
                  savedKey={settings.anthropicApiKey || ""}
                  onSave={(key) => {
                    updateSettings({ anthropicApiKey: key });
                    syncToCloud({ anthropic_api_key: key });
                  }}
                  onRemove={() => {
                    updateSettings({ anthropicApiKey: "" });
                    syncToCloud({ anthropic_api_key: "" });
                  }}
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg mt-2">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>
                  {user
                    ? "API keys are encrypted in your Supabase profile and synced across devices. They are never sent to any server except the respective AI provider."
                    : "API keys are stored only in your browser's local storage. Sign in to sync them across devices."}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* GitHub */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <GithubSettings />
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>Customize how Alpha looks</CardDescription>
            </CardHeader>
            <CardContent>
              <Label className="text-sm mb-3 block">Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      updateSettings({ theme: value });
                      setTheme(value);
                      toast.success(`Theme set to ${label}`);
                    }}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                      settings.theme === value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Study Preferences */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Study Preferences</CardTitle>
              <CardDescription>Customize your learning experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm mb-2 block">Default Explanation Difficulty</Label>
                <Select
                  value={settings.defaultDifficulty}
                  onValueChange={(v) => {
                    updateSettings({ defaultDifficulty: v as typeof settings.defaultDifficulty });
                    syncToCloud({ default_difficulty: v });
                    toast.success("Default difficulty updated");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner — Simple language &amp; analogies</SelectItem>
                    <SelectItem value="intermediate">Intermediate — Balanced detail</SelectItem>
                    <SelectItem value="advanced">Advanced — Technical depth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-sm">Daily Study Goal</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{settings.dailyGoalMinutes} minutes per day</p>
                  </div>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {settings.dailyGoalMinutes} min
                  </span>
                </div>
                <Slider
                  value={[settings.dailyGoalMinutes]}
                  min={15}
                  max={240}
                  step={15}
                  onValueChange={([v]) => {
                    updateSettings({ dailyGoalMinutes: v });
                    syncToCloud({ daily_goal_minutes: v });
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>15 min</span>
                  <span>4 hours</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Study Reminders</Label>
                    <p className="text-xs text-muted-foreground">Get notified about study goals</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(v) => {
                    updateSettings({ notificationsEnabled: v });
                    syncToCloud({ notifications_enabled: v });
                    toast.success(v ? "Notifications enabled" : "Notifications disabled");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* About */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader><CardTitle className="text-base">About Alpha</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold">Alpha</div>
                  <div className="text-xs text-muted-foreground">
                    Version 1.1.0 · Gemini 2.5 Flash &amp; GPT-4o-mini
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                An intelligent study assistant powered by Google Gemini and OpenAI. Switch providers
                anytime — your data stays private in your browser.
              </p>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </DashboardLayout>
  );
}
