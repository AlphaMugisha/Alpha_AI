"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GamificationProvider } from "@/context/GamificationContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <GamificationProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </GamificationProvider>
  );
}
