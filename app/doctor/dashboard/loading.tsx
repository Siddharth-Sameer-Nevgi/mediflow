export default function DoctorDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 space-y-8">
      {/* Page header skeleton */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-slate-800 rounded-xl w-60" />
          <div className="h-4 bg-slate-800/70 rounded-lg w-44" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-800" />
      </div>

      {/* Stat cards row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="h-5 w-14 rounded-full bg-slate-800" />
            </div>
            <div className="h-8 bg-slate-800 rounded-lg w-2/5" />
            <div className="h-3.5 bg-slate-800/70 rounded-md w-3/5" />
          </div>
        ))}
      </div>

      {/* Queue section heading */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="h-5 bg-slate-800 rounded-lg w-40" />
        <div className="h-4 bg-slate-800/60 rounded-md w-24" />
      </div>

      {/* Queue card skeletons — 5 items */}
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4 flex items-center gap-4"
          >
            {/* Queue number badge */}
            <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0" />

            {/* Patient info */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded-md w-40" />
              <div className="h-3 bg-slate-800/70 rounded-md w-56" />
            </div>

            {/* Wait time */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="h-6 w-20 rounded-full bg-slate-800" />
              <div className="h-3 w-14 rounded bg-slate-800/60" />
            </div>

            {/* Action button */}
            <div className="w-28 h-9 rounded-xl bg-slate-800 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
