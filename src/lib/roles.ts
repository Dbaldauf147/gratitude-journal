/**
 * Who sees what. Both checks below only decide what the UI offers — the data
 * itself is protected server-side, by row-level security on `jokes` and by the
 * session check in /api/joke/today.
 */

/**
 * The Jokes tab — importing and rating — is one person's, by request. It isn't
 * part of what a new account gets.
 */
export const JOKES_OWNER_EMAIL = "baldaufdan@gmail.com";

export const ownsJokes = (email?: string | null) =>
  (email || "").toLowerCase() === JOKES_OWNER_EMAIL;

/**
 * Who gets a joke on their daily view. Reading is separate from curating: these
 * accounts see one SFW joke a day and never the rating queue, so an unreviewed
 * joke can't reach them.
 */
export const DAILY_JOKE_EMAILS = ["joannejyseo@gmail.com"];

export const seesDailyJoke = (email?: string | null) =>
  DAILY_JOKE_EMAILS.includes((email || "").toLowerCase());
