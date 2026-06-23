"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageCircle,
  FileText,
  Brain,
  Layers,
  Lightbulb,
  Calendar,
  FolderKanban,
  Github,
  Settings,
  GraduationCap,
  ClipboardCheck,
  Sparkles,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const navSections: {
  label: string | null;
  items: { href: string; icon: typeof LayoutDashboard; label: string }[];
}[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/coach", icon: Sparkles, label: "Jarvis" },
      { href: "/achievements", icon: Trophy, label: "Progress" },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/chat", icon: MessageCircle, label: "AI Chat" },
      { href: "/notes", icon: FileText, label: "Notes Generator" },
      { href: "/explain", icon: Lightbulb, label: "Explain Topic" },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/quiz", icon: Brain, label: "Quiz Generator" },
      { href: "/exam", icon: ClipboardCheck, label: "Exam Mode" },
      { href: "/flashcards", icon: Layers, label: "Flashcards" },
    ],
  },
  {
    label: "Organize",
    items: [
      { href: "/planner", icon: Calendar, label: "Study Planner" },
      { href: "/projects", icon: FolderKanban, label: "Projects" },
      { href: "/repos", icon: Github, label: "My Repos" },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", icon: Settings, label: "Settings" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  // `collapsed` is the pinned state (toggle button). Hovering temporarily
  // expands it; leaving collapses it again — unless it's pinned open.
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;
  const { user, profile } = useAuth();

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        animate={{ width: expanded ? 240 : 64 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative flex flex-col border-r bg-card/50 backdrop-blur-sm min-h-screen shrink-0"
      >
        <div className="flex items-center justify-between p-4 border-b">
          {expanded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm gradient-text">Alpha</span>
            </motion.div>
          ) : (
            <div className="w-7 h-7 mx-auto rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
          )}
          {expanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Pin sidebar open" : "Unpin (collapse)"}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navSections.map((section, si) => (
            <div key={si} className={cn(si > 0 && "pt-3")}>
              {section.label &&
                (!expanded ? (
                  <div className="mx-2 mb-1 border-t border-border/60" />
                ) : (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.label}
                  </p>
                ))}
              <div className="space-y-1">
                {section.items.map(({ href, icon: Icon, label }) => {
                  const active =
                    pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Tooltip key={href}>
                      <TooltipTrigger asChild>
                        <Link href={href}>
                          <motion.div
                            whileHover={{ x: expanded ? 2 : 0 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              !expanded && "justify-center px-2"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {expanded && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.12, duration: 0.25 }}
                                className="truncate"
                              >
                                {label}
                              </motion.span>
                            )}
                          </motion.div>
                        </Link>
                      </TooltipTrigger>
                      {!expanded && (
                        <TooltipContent side="right">{label}</TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user && (
          <div className={cn(
            "border-t p-3 flex items-center gap-3",
            !expanded && "justify-center"
          )}>
            <Avatar className="h-8 w-8 shrink-0 border-2 border-violet-500/30">
              <AvatarImage src={profile?.avatar_url ?? ""} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-w-0"
              >
                <p className="text-xs font-semibold truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </motion.div>
            )}
          </div>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}
