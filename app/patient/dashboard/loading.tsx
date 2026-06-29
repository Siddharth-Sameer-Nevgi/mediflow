export default function PatientDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 space-y-8">
      {/* Page header skeleton */}
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-slate-800 rounded-xl w-1/3" />
        <div className="h-4 bg-slate-800/70 rounded-lg w-1/2" />
      </div>

      {/* Stat cards row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
          >
            {/* Icon placeholder */}
            <div className="w-10 h-10 rounded-xl bg-slate-800" />
            {/* Value */}
            <div className="h-7 bg-slate-800 rounded-lg w-1/2" />
            {/* Label */}
            <div className="h-3.5 bg-slate-800/70 rounded-md w-3/4" />
          </div>
        ))}
      </div>

      {/* Section heading */}
      <div className="animate-pulse">
        <div className="h-5 bg-slate-800 rounded-lg w-48" />
      </div>

      {/* Appointment card skeletons — 2 cards */}
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex items-center gap-4"
          >
            {/* Avatar / date block */}
            <div className="w-12 h-12 rounded-xl bg-slate-800 shrink-0" />
            {/* Details */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded-md w-2/5" />
              <div className="h-3 bg-slate-800/70 rounded-md w-3/5" />
            </div>
            {/* Badge / action placeholder */}
            <div className="w-20 h-7 rounded-full bg-slate-800 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
