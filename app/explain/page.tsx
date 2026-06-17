"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { explainTopic } from "@/lib/ai";
import { Difficulty } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Lightbulb,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Zap,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { cn } from "@/lib/utils";

const DIFFICULTY_CONFIG = {
  beginner: {
    label: "Beginner",
    icon: Zap,
    color: "from-green-500 to-emerald-600",
    desc: "Simple language, analogies, no jargon",
  },
  intermediate: {
    label: "Intermediate",
    icon: BookOpen,
    color: "from-blue-500 to-cyan-600",
    desc: "Clear explanations with some technical terms",
  },
  advanced: {
    label: "Advanced",
    icon: GraduationCap,
    color: "from-violet-500 to-purple-600",
    desc: "Deep dive with technical details and nuances",
  },
} as const;

const SAMPLE_TOPICS = [
  "How does photosynthesis work?",
  "What is machine learning?",
  "Explain Newton's laws of motion",
  "What is the difference between DNA and RNA?",
  "How does the internet work?",
  "What is inflation in economics?",
];

export default function ExplainPage() {
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");

  const handleExplain = async () => {
    if (!topic.trim()) { toast.error("Please enter a topic."); return; }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setIsLoading(true);
    setExplanation("");
    try {
      const result = await explainTopic(aiConfig, topic, difficulty, context);
      setExplanation(result);
      setCurrentTopic(topic);
      addSession("explain", `Explain: ${topic}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate explanation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleReset = () => {
    setExplanation("");
    setTopic("");
    setContext("");
    setCurrentTopic("");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Explain Topic"
        description="Get clear AI explanations at your chosen difficulty level"
        icon={<Lightbulb className="w-5 h-5" />}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input card */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label className="text-sm font-medium mb-2 block">What do you want to understand?</Label>
              <Input
                placeholder="e.g., How does photosynthesis work? What is recursion in programming?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExplain()}
                className="text-base"
              />
            </div>

            {/* Sample topics */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className="text-xs px-3 py-1.5 rounded-full border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty selector */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Difficulty Level</Label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setDifficulty(key)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        difficulty === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2",
                        config.color
                      )}>
                        <config.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="font-semibold text-sm">{config.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{config.desc}</div>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Optional context */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Additional Context <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g., I'm studying for a biology exam, focus on cellular respiration..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleExplain}
              disabled={!topic.trim() || isLoading || !hasApiKey}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              size="lg"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Explanation...</>
              ) : (
                <><Lightbulb className="w-4 h-4 mr-2" /> Explain This Topic</>
              )}
            </Button>

            {!hasApiKey && (
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/settings" className="text-primary hover:underline">Add your Gemini API key</Link> to get explanations.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Explanation result */}
        <AnimatePresence>
          {isLoading && !explanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-12"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Lightbulb className="w-8 h-8 text-white animate-pulse" />
                </div>
                <p className="text-muted-foreground">Crafting your personalized explanation...</p>
              </div>
            </motion.div>
          )}

          {explanation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{currentTopic}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full text-white font-medium bg-gradient-to-r",
                        DIFFICULTY_CONFIG[difficulty].color
                      )}>
                        {DIFFICULTY_CONFIG[difficulty].label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="w-4 h-4 mr-2" /> New Topic
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExplain}
                      disabled={isLoading}
                    >
                      <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                      Regenerate
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-[600px]">
                  <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {explanation}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              </Card>

              {/* Try different difficulty */}
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border">
                <Lightbulb className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">
                  Want a different perspective? Try the same topic at a different difficulty level.
                </p>
                <div className="flex gap-2">
                  {(["beginner", "intermediate", "advanced"] as Difficulty[])
                    .filter(d => d !== difficulty)
                    .map(d => (
                      <Button
                        key={d}
                        size="sm"
                        variant="outline"
                        onClick={() => { setDifficulty(d); handleExplain(); }}
                        className="capitalize"
                      >
                        {d}
                      </Button>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
