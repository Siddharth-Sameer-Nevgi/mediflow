export default function QueueLoading() {
  return (
    <div className="max-w-lg mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-800 rounded-xl w-48" />
          <div className="h-4 bg-slate-800/60 rounded-lg w-24" />
        </div>
        <div className="h-8 bg-slate-800 rounded-full w-20" />
      </div>
      {/* Main card */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-8 space-y-8">
        {/* Animated ring placeholder */}
        <div className="flex items-center justify-center">
          <div className="w-36 h-36 rounded-full bg-slate-700/60" />
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-18 bg-slate-700/40 rounded-xl p-4 space-y-2">
              <div className="h-6 bg-slate-700 rounded w-8 mx-auto" />
              <div className="h-3 bg-slate-700/60 rounded w-16 mx-auto" />
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-700 rounded-full" />
        {/* Action buttons */}
        <div className="flex gap-3">
          <div className="h-11 bg-slate-700/60 rounded-xl flex-1" />
          <div className="h-11 bg-slate-700/60 rounded-xl flex-1" />
        </div>
      </div>
      {/* Info card */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700" />
            <div className="h-4 bg-slate-700 rounded flex-1 max-w-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}
