import { createServerSupabase } from "@/lib/supabase-server";
import AppHeader from "@/app/AppHeader";
import LookupUploads from "./LookupUploads";
import { MANDATE_LABELS } from "@/lib/types";
import type { MandateType } from "@/lib/types";

export default async function LookupsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: jurisdictionCount }, { data: mandates }] = await Promise.all([
    supabase.from("jurisdictions").select("id", { count: "exact", head: true }),
    supabase.from("mandates").select("type"),
  ]);

  const byType: Record<MandateType, number> = {
    benchmarking: 0,
    audit: 0,
    bps: 0,
    utility_data_feed: 0,
  };
  for (const m of (mandates ?? []) as { type: MandateType }[]) {
    byType[m.type] = (byType[m.type] || 0) + 1;
  }

  return (
    <main className="min-h-screen">
      <AppHeader email={user?.email} />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-2">Jurisdiction lookups</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Upload CSVs that define the jurisdictions and compliance mandates the
          screening tool maps buildings against. These are shared across all
          users.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-10">
          <Stat label="Jurisdictions" value={jurisdictionCount ?? 0} />
          {(Object.keys(byType) as MandateType[]).map((t) => (
            <Stat key={t} label={MANDATE_LABELS[t]} value={byType[t]} />
          ))}
        </div>

        <LookupUploads />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-md border border-[var(--border)] bg-[var(--surface)]">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
