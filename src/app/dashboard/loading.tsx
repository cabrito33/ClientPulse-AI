export default function DashboardLoading() {
  return (
    <main
      aria-label="A carregar painel"
      className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:py-10"
    >
      {/* Top greeting and actions skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-28 rounded bg-line/80 animate-pulse" />
          <div className="mt-2.5 h-8 w-60 rounded-lg bg-line animate-pulse" />
          <div className="mt-2 h-4 w-72 rounded bg-line/60 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-full bg-line animate-pulse" />
          <div className="h-9 w-32 rounded-full bg-line animate-pulse" />
        </div>
      </div>

      {/* KPI stats cards skeleton */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_1px_rgba(18,23,27,0.03)]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-line/70 animate-pulse" />
              <div className="h-4 w-4 rounded-full bg-line/60 animate-pulse" />
            </div>
            <div className="mt-3.5 h-7 w-16 rounded bg-line animate-pulse" />
            <div className="mt-2 h-3 w-24 rounded bg-line/60 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main split sections (Reports & Clients) skeleton */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="h-4 w-36 rounded bg-line animate-pulse" />
            <div className="h-5 w-24 rounded-full bg-line animate-pulse" />
          </div>
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-start gap-3.5 py-1">
                <div className="h-9 w-9 rounded-full bg-line shrink-0 animate-pulse" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-44 rounded bg-line animate-pulse" />
                  <div className="h-3 w-60 rounded bg-line/70 animate-pulse" />
                  <div className="h-2.5 w-32 rounded bg-line/50 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="h-4 w-32 rounded bg-line animate-pulse" />
            <div className="h-4 w-12 rounded bg-line/60 animate-pulse" />
          </div>
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-line shrink-0 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-line animate-pulse" />
                    <div className="h-2.5 w-36 rounded bg-line/60 animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-14 rounded-full bg-line animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sprint board & chart skeleton */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 rounded bg-line animate-pulse" />
            <div className="h-5 w-24 rounded bg-line animate-pulse" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-line/60 bg-sand/30 p-2.5 space-y-2">
                <div className="h-3 w-16 rounded bg-line animate-pulse" />
                <div className="h-16 rounded-lg bg-surface border border-line/50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="h-4 w-44 rounded bg-line animate-pulse" />
          <div className="mt-1 h-3 w-28 rounded bg-line/60 animate-pulse" />
          <div className="mt-6 h-44 rounded-xl bg-sand/20 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
