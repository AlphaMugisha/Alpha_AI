export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
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
    </div>
  );
}
