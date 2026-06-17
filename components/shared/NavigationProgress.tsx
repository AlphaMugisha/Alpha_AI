"use client";

import { Suspense } from "react";
import { TopProgressBar } from "./TopProgressBar";

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <TopProgressBar />
    </Suspense>
  );
}
