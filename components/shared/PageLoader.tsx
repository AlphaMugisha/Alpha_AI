"use client";

import { useEffect, useState } from "react";

// Next.js doesn't expose its dev compile/render phase to app code, so we
// sequence the labels in the order they actually happen during a navigation:
// the route compiles first, then renders.
const PHASES = ["Compiling…", "Rendering…"] as const;

export function PageLoader() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-md">
      {/* Fancy gradient arc spinner (CSS-only, brand accent) */}
      <div
        className="h-11 w-11 animate-spin rounded-full"
        style={{
          background:
            "conic-gradient(from 90deg, transparent 0deg, hsl(var(--primary)) 300deg, transparent 360deg)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
      />
      <p
        key={phase}
        className="animate-in fade-in text-sm font-medium text-muted-foreground duration-300"
      >
        {PHASES[phase]}
      </p>
    </div>
  );
}
