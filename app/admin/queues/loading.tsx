export default function AdminQueuesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-800 rounded-xl w-48" />
          <div className="h-4 bg-slate-800/60 rounded-lg w-36" />
        </div>
        <div className="h-8 bg-slate-800 rounded-full w-24" />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700" />
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-700 rounded w-32" />
                <div className="h-3 bg-slate-700/60 rounded w-24" />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-700/30 border-b border-slate-700/30">
              {[1, 2, 3].map((j) => (
                <div key={j} className="py-3 flex flex-col items-center gap-1">
                  <div className="h-5 bg-slate-700 rounded w-8" />
                  <div className="h-3 bg-slate-700/60 rounded w-14" />
                </div>
              ))}
            </div>
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-8 bg-slate-700/40 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
