import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";

export default async function LandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--text)]">
            Compliance Screening Tool
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link
                  href="/portfolio"
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Portfolio
                </Link>
                <Link
                  href="/admin/lookups"
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Lookups
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight mb-4">
          Screen a building portfolio against every city, county, and state
          compliance mandate.
        </h1>
        <p className="text-lg text-[var(--text-muted)] mb-8">
          Upload a list of buildings. Get back a compliance matrix mapping each
          one to the applicable energy benchmarking, audit / retro-commissioning,
          building performance standard (BPS), and whole-building utility data
          feed mandate &mdash; with thresholds, deadlines, and statutory
          citations.
        </p>
        <div className="flex gap-3">
          <Link
            href={user ? "/portfolio/upload" : "/signup"}
            className="px-5 py-3 rounded-md bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)]"
          >
            Upload portfolio
          </Link>
          <Link
            href={user ? "/portfolio" : "/login"}
            className="px-5 py-3 rounded-md border border-[var(--border)] bg-[var(--surface)] font-medium hover:border-[var(--accent)]"
          >
            {user ? "View portfolio" : "Sign in"}
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: "Benchmarking",
            body:
              "Annual ENERGY STAR Portfolio Manager reporting under local ordinances (NYC LL84, Boston BERDO, DC, Seattle, etc.).",
          },
          {
            title: "Audit / RCx",
            body:
              "Periodic energy audit or retro-commissioning requirements (e.g., NYC LL87, CA AB 802, NYSERDA).",
          },
          {
            title: "BPS",
            body:
              "Building Performance Standards setting absolute energy or GHG limits with compliance periods.",
          },
          {
            title: "Utility Data Feed",
            body:
              "Whole-building aggregated utility data release mandates that trigger utility and owner obligations.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="p-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
          >
            <h3 className="font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-[var(--text-muted)]">{c.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
