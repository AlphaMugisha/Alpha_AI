"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useVoice } from "@/hooks/useVoice";
import { VOICES, DEFAULT_VOICE_ID } from "@/lib/voice/voices";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AudioLines,
  Key,
  Eye,
  EyeOff,
  Check,
  Save,
  Trash2,
  ExternalLink,
  Shield,
  Play,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceSettings() {
  const { settings, updateSettings } = useSettings();
  const voice = useVoice();

  const savedKey = settings.elevenLabsApiKey || "";
  const [input, setInput] = useState(savedKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasKey = savedKey.trim().length > 0;
  const voiceId = settings.elevenLabsVoiceId || DEFAULT_VOICE_ID;
  const masked = savedKey ? savedKey.slice(0, 4) + "••••••••" + savedKey.slice(-4) : "";

  const handleSave = () => {
    if (!input.trim()) {
      toast.error("Please enter your ElevenLabs API key.");
      return;
    }
    updateSettings({ elevenLabsApiKey: input.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("ElevenLabs voice connected — Jarvis now speaks with a neural voice.");
  };

  const handleRemove = () => {
    updateSettings({ elevenLabsApiKey: "" });
    setInput("");
    toast.success("Removed — Jarvis will use the browser voice.");
  };

  const testVoice = () => {
    if (voice.speaking) {
      voice.cancel();
      return;
    }
    voice.speak(
      "All systems online. This is how I'll sound from now on — just say the word and I'll handle it.",
      { rate: 1.03 }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-violet-500" /> Jarvis Voice
          </CardTitle>
          {hasKey ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-xs">
              <Check className="w-3 h-3 mr-1" /> Neural voice
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted text-muted-foreground text-xs">
              Browser voice
            </Badge>
          )}
        </div>
        <CardDescription>
          Give Jarvis a realistic, human-sounding voice with ElevenLabs. Without a key, Jarvis
          falls back to your browser&apos;s built-in voice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              placeholder={hasKey ? "Enter a new key to update..." : "Paste your ElevenLabs API key..."}
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
          <Button onClick={handleSave} size="sm" className={cn(saved ? "bg-green-600 hover:bg-green-700" : "")}>
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          </Button>
          {hasKey && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <a
          href="https://elevenlabs.io/app/settings/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Get an API key at elevenlabs.io (free tier available)
        </a>

        <Separator />

        <div>
          <Label className="text-sm mb-2 block">Voice</Label>
          <div className="flex gap-2">
            <Select
              value={voiceId}
              onValueChange={(v) => {
                updateSettings({ elevenLabsVoiceId: v });
                toast.success("Voice updated");
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground"> — {v.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={testVoice} className="shrink-0">
              {voice.speaking ? (
                <><Square className="w-4 h-4 mr-1" /> Stop</>
              ) : (
                <><Play className="w-4 h-4 mr-1" /> Test</>
              )}
            </Button>
          </div>
          {!hasKey && (
            <p className="text-xs text-muted-foreground mt-2">
              Add a key above to hear the neural voice — the test will use your browser voice until then.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            Your ElevenLabs key is stored only in this browser and sent directly to ElevenLabs to
            generate speech — never to any other server.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
