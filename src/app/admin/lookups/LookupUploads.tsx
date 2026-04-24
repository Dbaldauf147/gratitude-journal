"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { parseCsv } from "@/lib/csv";

const JURISDICTION_REQUIRED = ["slug", "name", "level", "state"] as const;
const MANDATE_REQUIRED = [
  "jurisdiction_slug",
  "type",
  "name",
] as const;
const MANDATE_TYPES = ["benchmarking", "audit", "bps", "utility_data_feed"];

export default function LookupUploads() {
  return (
    <div className="space-y-10">
      <JurisdictionUpload />
      <hr className="border-[var(--border)]" />
      <MandateUpload />
    </div>
  );
}

function JurisdictionUpload() {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(f: File | null) {
    setRows(null);
    setErrors([]);
    setStatus("");
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    const errs: string[] = [];
    if (parsed.length === 0) {
      errs.push("CSV is empty.");
      setErrors(errs);
      return;
    }
    const missing = JURISDICTION_REQUIRED.filter((r) => !(r in parsed[0]));
    if (missing.length > 0) {
      errs.push(`Missing required column(s): ${missing.join(", ")}`);
      setErrors(errs);
      return;
    }
    parsed.forEach((r, i) => {
      const row = i + 2;
      if (!r.slug) errs.push(`Row ${row}: slug required`);
      if (!r.name) errs.push(`Row ${row}: name required`);
      if (!r.state) errs.push(`Row ${row}: state required`);
      if (!["state", "county", "city", "other"].includes(r.level)) {
        errs.push(
          `Row ${row}: level must be one of state, county, city, other`
        );
      }
    });
    setRows(parsed);
    setErrors(errs);
  }

  async function submit() {
    if (!rows || errors.length > 0) return;
    setSubmitting(true);
    setStatus("Uploading...");
    const supabase = createClient();
    const payload = rows.map((r) => ({
      slug: r.slug.trim().toLowerCase(),
      name: r.name,
      level: r.level,
      city: r.city || null,
      county: r.county || null,
      state: r.state.toUpperCase(),
      notes: r.notes || null,
    }));
    const { error } = await supabase
      .from("jurisdictions")
      .upsert(payload, { onConflict: "slug" });
    if (error) {
      setStatus(`Error: ${error.message}`);
      setSubmitting(false);
      return;
    }
    setStatus(`Upserted ${payload.length} jurisdictions.`);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Jurisdictions CSV</h2>
        <a
          href="/api/templates/jurisdictions"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Download template
        </a>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-3">
        Required columns:{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">slug</code>,{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">name</code>,{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">level</code>{" "}
        (state | county | city | other),{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">state</code>.
        Optional:{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">city</code>,{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">county</code>,{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">notes</code>.
        Rows are upserted by{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">slug</code>.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm mb-3"
      />
      {errors.length > 0 && (
        <ErrorList errors={errors} />
      )}
      {rows && rows.length > 0 && (
        <div className="text-xs text-[var(--text-muted)] mb-3">
          {rows.length} rows parsed
        </div>
      )}
      <button
        onClick={submit}
        disabled={!rows || errors.length > 0 || submitting}
        className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {submitting ? "Uploading..." : "Upload jurisdictions"}
      </button>
      {status && (
        <span className="ml-3 text-sm text-[var(--text-muted)]">{status}</span>
      )}
    </section>
  );
}

function MandateUpload() {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(f: File | null) {
    setRows(null);
    setErrors([]);
    setStatus("");
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    const errs: string[] = [];
    if (parsed.length === 0) {
      errs.push("CSV is empty.");
      setErrors(errs);
      return;
    }
    const missing = MANDATE_REQUIRED.filter((r) => !(r in parsed[0]));
    if (missing.length > 0) {
      errs.push(`Missing required column(s): ${missing.join(", ")}`);
      setErrors(errs);
      return;
    }
    parsed.forEach((r, i) => {
      const row = i + 2;
      if (!r.jurisdiction_slug)
        errs.push(`Row ${row}: jurisdiction_slug required`);
      if (!r.name) errs.push(`Row ${row}: name required`);
      if (!MANDATE_TYPES.includes(r.type)) {
        errs.push(`Row ${row}: type must be one of ${MANDATE_TYPES.join(", ")}`);
      }
      if (r.sqft_threshold && !Number.isFinite(Number(r.sqft_threshold))) {
        errs.push(`Row ${row}: sqft_threshold must be numeric`);
      }
    });
    setRows(parsed);
    setErrors(errs);
  }

  async function submit() {
    if (!rows || errors.length > 0) return;
    setSubmitting(true);
    setStatus("Looking up jurisdictions...");
    const supabase = createClient();

    const slugs = Array.from(
      new Set(rows.map((r) => r.jurisdiction_slug.trim().toLowerCase()))
    );
    const { data: jurisdictions, error: jerr } = await supabase
      .from("jurisdictions")
      .select("id, slug")
      .in("slug", slugs);
    if (jerr) {
      setStatus(`Error: ${jerr.message}`);
      setSubmitting(false);
      return;
    }
    const bySlug = new Map(
      (jurisdictions ?? []).map((j: { id: string; slug: string }) => [
        j.slug,
        j.id,
      ])
    );
    const missingSlugs = slugs.filter((s) => !bySlug.has(s));
    if (missingSlugs.length > 0) {
      setStatus(
        `Missing jurisdictions (upload them first): ${missingSlugs.join(", ")}`
      );
      setSubmitting(false);
      return;
    }

    const payload = rows.map((r) => ({
      jurisdiction_id: bySlug.get(r.jurisdiction_slug.trim().toLowerCase()),
      type: r.type,
      name: r.name,
      citation: r.citation || null,
      sqft_threshold: r.sqft_threshold ? Number(r.sqft_threshold) : null,
      property_types: r.property_types
        ? r.property_types
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
      first_due: r.first_due || null,
      cadence: r.cadence || null,
      source_url: r.source_url || null,
      notes: r.notes || null,
    }));

    setStatus("Uploading mandates...");
    const { error } = await supabase.from("mandates").insert(payload);
    if (error) {
      setStatus(`Error: ${error.message}`);
      setSubmitting(false);
      return;
    }
    setStatus(`Inserted ${payload.length} mandates.`);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Mandates CSV</h2>
        <a
          href="/api/templates/mandates"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Download template
        </a>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-3">
        Required:{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">
          jurisdiction_slug
        </code>
        ,{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">type</code>{" "}
        (benchmarking | audit | bps | utility_data_feed),{" "}
        <code className="bg-[var(--surface-alt)] px-1 rounded">name</code>.
        Optional: <code>citation</code>, <code>sqft_threshold</code>,{" "}
        <code>property_types</code> (semicolon-separated), <code>first_due</code>{" "}
        (YYYY-MM-DD), <code>cadence</code>, <code>source_url</code>,{" "}
        <code>notes</code>.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm mb-3"
      />
      {errors.length > 0 && <ErrorList errors={errors} />}
      {rows && rows.length > 0 && (
        <div className="text-xs text-[var(--text-muted)] mb-3">
          {rows.length} rows parsed
        </div>
      )}
      <button
        onClick={submit}
        disabled={!rows || errors.length > 0 || submitting}
        className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {submitting ? "Uploading..." : "Upload mandates"}
      </button>
      {status && (
        <span className="ml-3 text-sm text-[var(--text-muted)]">{status}</span>
      )}
    </section>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <div className="p-3 rounded-md border border-[var(--danger)] bg-red-50 text-sm mb-3">
      <div className="font-medium text-[var(--danger)] mb-1">
        {errors.length} error{errors.length === 1 ? "" : "s"}
      </div>
      <ul className="list-disc list-inside text-[var(--danger)] text-xs">
        {errors.slice(0, 20).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
        {errors.length > 20 && <li>...and {errors.length - 20} more</li>}
      </ul>
    </div>
  );
}
