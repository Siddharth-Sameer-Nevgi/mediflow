export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute top-1/4 -left-40 w-80 h-80 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative text-center max-w-md">
        <div className="text-[10rem] font-black leading-none bg-gradient-to-b from-sky-400 to-blue-600 bg-clip-text text-transparent select-none">
          404
        </div>
        <h1 className="text-2xl font-bold text-white mt-2 mb-3">Page Not Found</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-sky-500/25"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
