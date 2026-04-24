import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import AppHeader from "@/app/AppHeader";
import { screenBuilding, groupByType } from "@/lib/screening";
import type { Building, Jurisdiction, Mandate } from "@/lib/types";
import { MANDATE_LABELS, MANDATE_TYPES } from "@/lib/types";

export default async function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: building } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", id)
    .single();

  if (!building) notFound();

  const [{ data: jurisdictions }, { data: mandates }] = await Promise.all([
    supabase.from("jurisdictions").select("*"),
    supabase.from("mandates").select("*"),
  ]);

  const b = building as Building;
  const J = (jurisdictions ?? []) as Jurisdiction[];
  const M = (mandates ?? []) as Mandate[];
  const screened = screenBuilding(b, J, M);
  const grouped = groupByType(screened);

  return (
    <main className="min-h-screen">
      <AppHeader email={user?.email} />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/portfolio"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          &larr; Portfolio
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-1">
          {b.name || b.address}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {b.address}, {b.city}, {b.state} {b.zip} &middot;{" "}
          {b.sqft.toLocaleString()} sqft
          {b.property_type ? ` · ${b.property_type}` : ""}
        </p>

        <div className="mt-8 space-y-8">
          {MANDATE_TYPES.map((t) => {
            const items = grouped[t];
            return (
              <section key={t}>
                <h2 className="text-lg font-semibold mb-3">
                  {MANDATE_LABELS[t]}
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] px-4 py-6 border border-dashed border-[var(--border)] rounded-md">
                    No mandates of this type found for {b.city}, {b.state}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className={`p-4 rounded-md border bg-[var(--surface)] ${
                          m.applies
                            ? "border-[var(--accent)]"
                            : "border-[var(--border)] opacity-70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{m.name}</h3>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  m.applies
                                    ? "bg-[var(--success)] text-white"
                                    : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
                                }`}
                              >
                                {m.applies ? "Applies" : "Does not apply"}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              {m.jurisdiction.name}
                              {m.citation ? ` · ${m.citation}` : ""}
                            </div>
                          </div>
                          {m.source_url && (
                            <a
                              href={m.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
                            >
                              Source &rarr;
                            </a>
                          )}
                        </div>
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                          <div>
                            <dt className="text-[var(--text-muted)]">
                              Threshold
                            </dt>
                            <dd>
                              {m.sqft_threshold
                                ? `${m.sqft_threshold.toLocaleString()} sqft`
                                : "Any size"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">
                              Next due
                            </dt>
                            <dd>{m.first_due || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">
                              Cadence
                            </dt>
                            <dd>{m.cadence || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">
                              Property types
                            </dt>
                            <dd>
                              {m.property_types && m.property_types.length
                                ? m.property_types.join(", ")
                                : "All"}
                            </dd>
                          </div>
                        </dl>
                        {m.reason && (
                          <p className="text-xs text-[var(--text-muted)] mt-3">
                            {m.reason}
                          </p>
                        )}
                        {m.notes && (
                          <p className="text-xs text-[var(--text-muted)] mt-2">
                            {m.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
