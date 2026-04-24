import Link from "next/link";

export default function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-[var(--text)]">
          Compliance Screening Tool
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/portfolio"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Portfolio
          </Link>
          <Link
            href="/portfolio/upload"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Upload
          </Link>
          <Link
            href="/admin/lookups"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Lookups
          </Link>
          {email ? (
            <span className="text-[var(--text-muted)] text-xs">{email}</span>
          ) : null}
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
