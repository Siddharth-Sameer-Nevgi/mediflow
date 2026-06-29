export default function PatientBookLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl animate-pulse space-y-8">
        {/* Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/50">
          {/* Card top bar */}
          <div className="h-1 w-full bg-slate-800" />

          <div className="p-8 space-y-8">
            {/* Step indicator — 4 circles connected by lines */}
            <div className="flex items-center justify-center gap-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-slate-800 shrink-0" />
                  {i < 3 && (
                    <div className="w-16 h-0.5 bg-slate-800" />
                  )}
                </div>
              ))}
            </div>

            {/* Step label */}
            <div className="flex justify-center">
              <div className="h-3.5 bg-slate-800 rounded-md w-40" />
            </div>

            {/* Form title */}
            <div className="space-y-2">
              <div className="h-6 bg-slate-800 rounded-lg w-1/2" />
              <div className="h-3.5 bg-slate-800/70 rounded-md w-3/4" />
            </div>

            {/* Form field skeletons */}
            <div className="space-y-5">
              {/* Field 1: full width */}
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-800 rounded-md w-28" />
                <div className="h-11 bg-slate-800/80 rounded-xl w-full" />
              </div>

              {/* Field 2 & 3: two columns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="h-3.5 bg-slate-800 rounded-md w-20" />
                  <div className="h-11 bg-slate-800/80 rounded-xl w-full" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 bg-slate-800 rounded-md w-20" />
                  <div className="h-11 bg-slate-800/80 rounded-xl w-full" />
                </div>
              </div>

              {/* Field 4: full width textarea-ish */}
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-800 rounded-md w-32" />
                <div className="h-24 bg-slate-800/80 rounded-xl w-full" />
              </div>
            </div>

            {/* CTA button */}
            <div className="h-12 bg-slate-800 rounded-xl w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
