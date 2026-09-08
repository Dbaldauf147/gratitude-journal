// Last-resort fallback: shown only when the service worker has no cached copy
// of the page being asked for and there's no network to fetch one.
export default function Offline() {
  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="text-center max-w-xs">
        <h1 className="text-xl font-light text-[var(--text)] mb-3">You&apos;re offline</h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Your journal will be here when you reconnect. Anything you&apos;ve already
          opened is still available.
        </p>
      </div>
    </main>
  );
}
