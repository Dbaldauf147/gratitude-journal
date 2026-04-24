import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import AppHeader from "@/app/AppHeader";
import { screenBuilding, groupByType } from "@/lib/screening";
import type { Building, Jurisdiction, Mandate } from "@/lib/types";
import { MANDATE_LABELS, MANDATE_TYPES } from "@/lib/types";

export default async function PortfolioPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: buildings }, { data: jurisdictions }, { data: mandates }] =
    await Promise.all([
      supabase
        .from("buildings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("jurisdictions").select("*"),
      supabase.from("mandates").select("*"),
    ]);

  const B = (buildings ?? []) as Building[];
  const J = (jurisdictions ?? []) as Jurisdiction[];
  const M = (mandates ?? []) as Mandate[];

  return (
    <main className="min-h-screen">
      <AppHeader email={user?.email} />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Portfolio</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {B.length} building{B.length === 1 ? "" : "s"} &middot; {J.length}{" "}
              jurisdictions &middot; {M.length} mandates loaded
            </p>
          </div>
          <Link
            href="/portfolio/upload"
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)]"
          >
            Upload buildings
          </Link>
        </div>

        {B.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-[var(--border)] rounded-md bg-[var(--surface)]">
            <p className="text-[var(--text-muted)] mb-3">
              No buildings uploaded yet.
            </p>
            <Link
              href="/portfolio/upload"
              className="text-[var(--accent)] hover:underline text-sm"
            >
              Upload your first portfolio CSV &rarr;
            </Link>
          </div>
        ) : (
          <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-alt)]">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Building</th>
                    <th className="px-3 py-2 font-medium">City, State</th>
                    <th className="px-3 py-2 font-medium text-right">Sqft</th>
                    {MANDATE_TYPES.map((t) => (
                      <th
                        key={t}
                        className="px-3 py-2 font-medium text-center"
                      >
                        {MANDATE_LABELS[t]}
                      </th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {B.map((b) => {
                    const screened = screenBuilding(b, J, M);
                    const applying = screened.filter((s) => s.applies);
                    const grouped = groupByType(applying);
                    return (
                      <tr
                        key={b.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {b.name || b.address}
                          </div>
                          {b.name && (
                            <div className="text-xs text-[var(--text-muted)]">
                              {b.address}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {b.city}, {b.state} {b.zip}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {b.sqft.toLocaleString()}
                        </td>
                        {MANDATE_TYPES.map((t) => {
                          const count = grouped[t].length;
                          return (
                            <td
                              key={t}
                              className="px-3 py-2 text-center"
                            >
                              {count > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-white">
                                  {count}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] text-xs">
                                  &mdash;
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/portfolio/${b.id}`}
                            className="text-[var(--accent)] hover:underline text-xs"
                          >
                            Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
