export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 space-y-8">
      {/* Page header skeleton */}
      <div className="animate-pulse flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-slate-800 rounded-xl w-64" />
          <div className="h-4 bg-slate-800/70 rounded-lg w-80" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-slate-800" />
          <div className="h-10 w-10 rounded-xl bg-slate-800" />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="h-5 w-16 rounded-full bg-slate-800" />
            </div>
            <div className="h-8 bg-slate-800 rounded-lg w-1/2" />
            <div className="h-3.5 bg-slate-800/70 rounded-md w-3/4" />
            {/* Mini sparkline placeholder */}
            <div className="h-8 bg-slate-800/50 rounded-lg w-full" />
          </div>
        ))}
      </div>

      {/* Chart section heading */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="h-5 bg-slate-800 rounded-lg w-36" />
        <div className="h-8 w-32 rounded-lg bg-slate-800" />
      </div>

      {/* Two chart placeholder boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        {/* Chart 1 — larger */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          {/* Chart header */}
          <div className="flex items-center justify-between">
            <div className="h-5 bg-slate-800 rounded-md w-44" />
            <div className="h-8 w-24 rounded-lg bg-slate-800" />
          </div>
          {/* Y-axis labels + chart body */}
          <div className="flex gap-3 items-end">
            <div className="flex flex-col justify-between h-48 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-2.5 w-8 bg-slate-800/60 rounded" />
              ))}
            </div>
            <div className="flex-1 h-48 bg-slate-800/40 rounded-xl" />
          </div>
          {/* X-axis labels */}
          <div className="flex justify-between ml-11">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-2.5 w-8 bg-slate-800/60 rounded" />
            ))}
          </div>
        </div>

        {/* Chart 2 — donut / secondary */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 bg-slate-800 rounded-md w-36" />
            <div className="h-8 w-20 rounded-lg bg-slate-800" />
          </div>
          {/* Donut circle placeholder */}
          <div className="flex items-center justify-center py-4">
            <div className="w-44 h-44 rounded-full bg-slate-800/40 border-8 border-slate-800" />
          </div>
          {/* Legend rows */}
          <div className="space-y-2.5 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-slate-800 shrink-0" />
                <div className="h-3 bg-slate-800/70 rounded-md flex-1" />
                <div className="h-3 w-10 bg-slate-800 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
