import { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Gradient scene backdrop — dark navy */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_25%_15%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(37,99,235,0.22),transparent_55%)]" />

      <header className="p-4">
        <Link href="/" className="flex w-fit items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 shadow-lg">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="font-semibold text-white">Alpha</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <footer className="p-4 text-center text-sm text-white/60">
        © {new Date().getFullYear()} Alpha. All rights reserved.
      </footer>
    </div>
  );
}
