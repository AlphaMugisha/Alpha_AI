"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useStudyData } from "@/hooks/useStudyData";
import { useSettings } from "@/hooks/useSettings";
import {
  MessageCircle,
  FileText,
  Brain,
  Layers,
  Lightbulb,
  Calendar,
  FolderKanban,
  ClipboardCheck,
  ArrowRight,
  BookOpen,
  Trophy,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import { StudySession } from "@/types";
import { CommitGoalWidget } from "@/components/github/CommitGoalWidget";
import { NewRepoPrompt } from "@/components/github/NewRepoPrompt";
import { LiveClock } from "@/components/dashboard/LiveClock";
import { RotatingQuote } from "@/components/dashboard/RotatingQuote";
import { useAuth } from "@/hooks/useAuth";

const quickActions = [
  {
    href: "/chat",
    icon: MessageCircle,
    label: "AI Chat",
    desc: "Ask anything",
    color: "from-blue-500 to-cyan-500",
  },
  {
    href: "/notes",
    icon: FileText,
    label: "Generate Notes",
    desc: "Upload & summarize",
    color: "from-violet-500 to-purple-600",
  },
  {
    href: "/quiz",
    icon: Brain,
    label: "Create Quiz",
    desc: "Test your knowledge",
    color: "from-orange-500 to-red-500",
  },
  {
    href: "/exam",
    icon: ClipboardCheck,
    label: "Exam Mode",
    desc: "Timed test conditions",
    color: "from-rose-500 to-pink-600",
  },
  {
    href: "/flashcards",
    icon: Layers,
    label: "Flashcards",
    desc: "Study & memorize",
    color: "from-green-500 to-emerald-600",
  },
  {
    href: "/explain",
    icon: Lightbulb,
    label: "Explain Topic",
    desc: "Clear explanations",
    color: "from-yellow-500 to-orange-500",
  },
  {
    href: "/planner",
    icon: Calendar,
    label: "Study Planner",
    desc: "Plan your sessions",
    color: "from-pink-500 to-rose-500",
  },
  {
    href: "/projects",
    icon: FolderKanban,
    label: "Project Manager",
    desc: "Track your code projects",
    color: "from-teal-500 to-cyan-600",
  },
];

const sessionIcons: Record<StudySession["type"], typeof MessageCircle> = {
  chat: MessageCircle,
  notes: FileText,
  quiz: Brain,
  flashcards: Layers,
  explain: Lightbulb,
  planner: Calendar,
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { recentSessions, stats } = useStudyData();
  const { hasApiKey } = useSettings();
  const { profile } = useAuth();

  const firstName = profile?.full_name?.trim().split(" ")[0];

  const statCards = [
    { label: "Total Sessions", value: stats.totalSessions, icon: BookOpen, color: "text-blue-500" },
    { label: "Notes Created", value: stats.totalNotes, icon: FileText, color: "text-violet-500" },
    { label: "Quizzes Taken", value: stats.totalQuizzes, icon: Trophy, color: "text-orange-500" },
    { label: "Flashcard Decks", value: stats.totalFlashcardDecks, icon: Layers, color: "text-green-500" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold mb-1">
                {getGreeting()}
                {firstName ? `, ${firstName}` : ""} 👋
              </h2>
              <p className="text-violet-200 text-lg">
                Ready to learn something new today?
              </p>
              <RotatingQuote />
            </div>
            <div className="flex flex-col items-start md:items-end gap-4">
              <LiveClock />
              <Button
                asChild
                className="bg-white text-violet-700 hover:bg-violet-50 font-semibold"
              >
                <Link href="/chat">
                  Start Chatting <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* New repo detector — pops a prompt when GitHub has repos Alpha hasn't seen */}
        <NewRepoPrompt />

        {/* Daily commit goal */}
        <CommitGoalWidget />

        {/* API Key warning */}
        {!hasApiKey && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl"
          >
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                No Gemini API key configured.
              </span>{" "}
              <span className="text-amber-600 dark:text-amber-500">
                Add your key in Settings to unlock all AI features.
              </span>
            </div>
            <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400">
              <Link href="/settings">Add Key</Link>
            </Button>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quickActions.map((action, i) => (
                <motion.div
                  key={action.href}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                >
                  <Link href={action.href}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-5">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-md`}
                        >
                          <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="font-semibold text-sm mb-1">
                          {action.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {action.desc}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Recent Activity</h3>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <Card>
              <CardContent className="p-4">
                {recentSessions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>No sessions yet.</p>
                    <p className="text-xs mt-1">Start studying to see activity here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.slice(0, 8).map((session) => {
                      const Icon = sessionIcons[session.type] || BookOpen;
                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {session.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {timeAgo(session.createdAt)}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {session.type}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Tips */}
        <Card className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-violet-500" />
              Study Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { tip: "Use the Pomodoro technique: 25 min focus, 5 min break.", icon: Clock },
                { tip: "Test yourself with quizzes — active recall beats re-reading.", icon: Brain },
                { tip: "Review flashcards daily for spaced repetition benefits.", icon: Layers },
              ].map(({ tip, icon: Icon }) => (
                <div key={tip} className="flex items-start gap-3">
                  <Icon className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
