import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-lg text-center space-y-8">
        <div className="space-y-2">
          <p className="text-[var(--accent)] text-sm tracking-widest uppercase">
            Daily Reflection
          </p>
          <h1 className="text-5xl font-light text-[var(--text)] leading-tight">
            Gratitude Journal
          </h1>
        </div>

        <p className="text-lg text-[var(--text-muted)] leading-relaxed">
          End each day by reflecting on three things you&apos;re grateful for.
          A small practice that transforms your perspective.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/signup"
            className="px-8 py-3 rounded-full bg-[var(--accent)] text-white text-sm font-medium tracking-wide hover:bg-[var(--accent-hover)] transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-full border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium tracking-wide hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="pt-12 flex justify-center gap-6">
          <div className="w-3 h-3 rounded-full bg-[var(--pastel-rose)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--pastel-lavender)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--pastel-sage)]" />
        </div>
      </div>
    </main>
  );
}
