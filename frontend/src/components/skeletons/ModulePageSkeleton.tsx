export function ModulePageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-72 rounded bg-muted/60" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-muted" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="h-8 w-12 rounded bg-muted mb-1 mx-auto" />
            <div className="h-3 w-16 rounded bg-muted/60 mx-auto" />
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-muted shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 rounded bg-muted" style={{ width: `${40 + (i % 3) * 20}%` }} />
                  <div className="h-4 w-16 rounded-full bg-muted/60" />
                  <div className="h-4 w-20 rounded-full bg-muted/60" />
                </div>
                <div className="h-3 rounded bg-muted/40" style={{ width: `${55 + (i % 2) * 25}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-xl bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
