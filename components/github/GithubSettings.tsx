"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getGithubStatus,
  connectGithub,
  disconnectGithub,
  setDailyGoal,
  type GithubStatus,
} from "@/app/actions/github";
import { toast } from "sonner";
import {
  Github,
  Check,
  Loader2,
  ExternalLink,
  Trash2,
  Target,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export function GithubSettings() {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [token, setToken] = useState("");
  const [goal, setGoal] = useState(20);
  const [pending, start] = useTransition();

  const refresh = async () => {
    const s = await getGithubStatus();
    setStatus(s);
    setGoal(s.dailyGoal);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = () => {
    if (!token.trim()) {
      toast.error("Paste your GitHub token first.");
      return;
    }
    start(async () => {
      const res = await connectGithub(token);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Connected as ${res.username}! 🎉`);
        setToken("");
        await refresh();
      }
    });
  };

  const handleDisconnect = () => {
    start(async () => {
      await disconnectGithub();
      toast.success("GitHub disconnected.");
      await refresh();
    });
  };

  const handleSaveGoal = () => {
    start(async () => {
      const res = await setDailyGoal(goal);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Daily goal set to ${res.goal} commits.`);
        await refresh();
      }
    });
  };

  const connected = status?.connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Github className="w-4 h-4" /> GitHub
        </CardTitle>
        <CardDescription>
          Connect GitHub to track your daily commit goal and get push reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <>
            <div>
              <Label className="text-sm mb-2 block">Personal Access Token</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleConnect}
                  disabled={pending}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 p-3 bg-muted/50 rounded-lg">
              <p className="font-medium text-foreground">How to create a token (≈30s):</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>
                  Open{" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Alpha"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    github.com/settings/tokens/new <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Keep the <strong>repo</strong> scope ticked (already pre-selected via that link)</li>
                <li>Set an expiry, click <strong>Generate token</strong></li>
                <li>Copy it and paste above — that&apos;s it.</li>
              </ol>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-xs">
                  <Check className="w-3 h-3 mr-1" /> Connected
                </Badge>
                <span className="text-sm font-medium">@{status?.username}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={pending}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Disconnect
              </Button>
            </div>

            <Separator />

            <div>
              <Label className="text-sm mb-2 block">Daily Commit Goal</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={goal}
                  onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">commits / day</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveGoal}
                  disabled={pending}
                  className="ml-auto"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-muted-foreground">Focus repo:</span>
                <span className="font-medium">
                  {status?.focusRepo ?? "not set"}
                </span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/repos">
                  {status?.focusRepo ? "Change" : "Choose"}
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
