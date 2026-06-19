"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Bell, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { useJarvis } from "@/context/JarvisContext";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/coach": "Jarvis — AI Study Coach",
  "/achievements": "Progress & Achievements",
  "/chat": "AI Chat",
  "/notes": "Notes Generator",
  "/quiz": "Quiz Generator",
  "/flashcards": "Flashcards",
  "/explain": "Explain Topic",
  "/planner": "Study Planner",
  "/projects": "Project Manager",
  "/repos": "My Repos",
  "/profile": "Profile",
  "/settings": "Settings",
};

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [showSearch, setShowSearch] = useState(false);
  const jarvis = useJarvis();

  const title = PAGE_TITLES[pathname] || "Alpha";

  return (
    <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0">
      <h1 className="font-semibold text-lg flex-1">{title}</h1>

      <div className="flex items-center gap-2">
        {showSearch ? (
          <Input
            placeholder="Search..."
            className="w-48 h-8 text-sm"
            autoFocus
            onBlur={() => setShowSearch(false)}
          />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>

        {/* Jarvis — always one tap away from any page */}
        <Button
          variant="ghost"
          size="icon"
          onClick={jarvis.toggle}
          title="Talk to Jarvis"
          className={cn(
            "h-8 w-8 relative",
            jarvis.open && "text-violet-600 dark:text-violet-400"
          )}
        >
          <Sparkles className="h-4 w-4" />
          {jarvis.open && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-card" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
