export default function ProfileLoading() {
  return (
    <div className="animate-pulse space-y-6 max-w-3xl">
      <div className="space-y-2">
        <div className="h-7 bg-slate-800 rounded-xl w-40" />
        <div className="h-4 bg-slate-800/60 rounded-lg w-64" />
      </div>
      {/* Profile card */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-700 shrink-0" />
          <div className="space-y-2">
            <div className="h-6 bg-slate-700 rounded w-48" />
            <div className="h-4 bg-slate-700/60 rounded w-24" />
            <div className="h-4 bg-slate-700/60 rounded w-36" />
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700" />
            <div className="h-7 bg-slate-700 rounded w-12" />
            <div className="h-3 bg-slate-700/60 rounded w-20" />
          </div>
        ))}
      </div>
      {/* Detail rows */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700" />
            <div className="h-4 bg-slate-700 rounded flex-1 max-w-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}
