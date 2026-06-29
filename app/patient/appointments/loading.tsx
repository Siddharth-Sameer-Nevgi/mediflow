export default function PatientAppointmentsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 space-y-8">
      {/* Header skeleton */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-slate-800 rounded-xl w-52" />
          <div className="h-4 bg-slate-800/70 rounded-lg w-72" />
        </div>
        {/* Action button placeholder */}
        <div className="h-10 w-36 rounded-xl bg-slate-800" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="animate-pulse flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-slate-800" />
        ))}
      </div>

      {/* Appointment row skeletons — 4 rows */}
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4 flex items-center gap-4"
          >
            {/* Date block */}
            <div className="w-14 h-14 rounded-xl bg-slate-800 shrink-0" />

            {/* Center info */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded-md w-48" />
              <div className="h-3 bg-slate-800/70 rounded-md w-64" />
              <div className="h-3 bg-slate-800/60 rounded-md w-36" />
            </div>

            {/* Status badge */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="h-6 w-24 rounded-full bg-slate-800" />
              <div className="h-3 w-16 rounded bg-slate-800/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
