export default function DoctorAppointmentsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 space-y-8">
      {/* Header skeleton */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-slate-800 rounded-xl w-56" />
          <div className="h-4 bg-slate-800/70 rounded-lg w-72" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-slate-800" />
          <div className="h-10 w-10 rounded-xl bg-slate-800" />
        </div>
      </div>

      {/* Filter / date bar skeleton */}
      <div className="animate-pulse flex gap-3 items-center">
        <div className="h-10 w-44 rounded-xl bg-slate-800" />
        <div className="h-10 w-28 rounded-lg bg-slate-800" />
        <div className="h-10 w-28 rounded-lg bg-slate-800" />
        <div className="ml-auto h-10 w-36 rounded-xl bg-slate-800" />
      </div>

      {/* Appointment row skeletons — 4 rows */}
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4 flex items-center gap-4"
          >
            {/* Time column */}
            <div className="flex flex-col items-center gap-1 w-14 shrink-0">
              <div className="h-4 bg-slate-800 rounded-md w-full" />
              <div className="h-3 bg-slate-800/60 rounded-md w-3/4" />
            </div>

            {/* Vertical divider */}
            <div className="w-px h-12 bg-slate-800 shrink-0" />

            {/* Patient info */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded-md w-44" />
              <div className="h-3 bg-slate-800/70 rounded-md w-60" />
            </div>

            {/* Type badge */}
            <div className="h-6 w-24 rounded-full bg-slate-800 shrink-0" />

            {/* Status badge */}
            <div className="h-6 w-20 rounded-full bg-slate-800 shrink-0" />

            {/* Action dots */}
            <div className="w-8 h-8 rounded-lg bg-slate-800 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
