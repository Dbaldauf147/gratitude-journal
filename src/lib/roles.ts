/**
 * The Jokes tab is one person's, by request — it isn't part of what a new
 * account gets. This only hides the tab; what actually keeps the rows private
 * is the row-level security on `jokes`, which scopes every read to auth.uid().
 */
export const JOKES_OWNER_EMAIL = "baldaufdan@gmail.com";

export const ownsJokes = (email?: string | null) =>
  (email || "").toLowerCase() === JOKES_OWNER_EMAIL;
