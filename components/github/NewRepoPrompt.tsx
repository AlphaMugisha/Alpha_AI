"use client";

import { useEffect, useState } from "react";
import {
  detectNewRepos,
  classifyRepo,
  dismissNewRepo,
  type NewRepo,
} from "@/app/actions/github";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Globe,
  FolderKanban,
  FileCheck2,
  BookOpen,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export function NewRepoPrompt() {
  const [repos, setRepos] = useState<NewRepo[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    detectNewRepos()
      .then((res) => {
        if (res.newRepos.length > 0) {
          setRepos(res.newRepos);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const remove = (fullName: string) =>
    setRepos((prev) => {
      const next = prev.filter((r) => r.fullName !== fullName);
      if (next.length === 0) setOpen(false);
      return next;
    });

  const classify = async (
    repo: NewRepo,
    category: "project" | "submission" | "revision"
  ) => {
    setBusy(repo.fullName);
    const res = await classifyRepo(repo.fullName, category);
    setBusy(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      category === "project"
        ? `${repo.name} added to Projects! 🚀`
        : `${repo.name} saved as ${category}.`
    );
    remove(repo.fullName);
  };

  const skip = async (repo: NewRepo) => {
    setBusy(repo.fullName);
    await dismissNewRepo(repo.fullName);
    setBusy(null);
    remove(repo.fullName);
  };

  if (repos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {repos.length > 1
              ? `${repos.length} new repos on GitHub`
              : "New repo on GitHub"}
          </DialogTitle>
          <DialogDescription>
            Classify {repos.length > 1 ? "these" : "this"} so Alpha knows what{" "}
            {repos.length > 1 ? "they are" : "it is"}. Tag as{" "}
            <strong>Project</strong> to start working on it here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {repos.map((repo) => (
            <div key={repo.fullName} className="p-3 rounded-xl border">
              <div className="flex items-center gap-2 mb-2.5 min-w-0">
                {repo.private ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-medium truncate">{repo.name}</span>
                {repo.language && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {repo.language}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === repo.fullName}
                  onClick={() => classify(repo, "project")}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  <FolderKanban className="w-3.5 h-3.5 mr-1" /> Project
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === repo.fullName}
                  onClick={() => classify(repo, "submission")}
                >
                  <FileCheck2 className="w-3.5 h-3.5 mr-1" /> Submission
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === repo.fullName}
                  onClick={() => classify(repo, "revision")}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" /> Revision
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === repo.fullName}
                  onClick={() => skip(repo)}
                  className="text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Skip
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
