"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { parseCsv } from "@/lib/csv";

type ParsedBuilding = {
  name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  sqft: number;
  property_type: string | null;
};

const REQUIRED = ["address", "city", "state", "zip", "sqft"] as const;

export default function UploadBuildingsForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedBuilding[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setErrors([]);
    setStatus("");
    if (!f) return;

    const text = await f.text();
    const rows = parseCsv(text);
    const errs: string[] = [];

    if (rows.length === 0) {
      errs.push("CSV is empty or missing a header row.");
      setErrors(errs);
      return;
    }

    const missing = REQUIRED.filter((r) => !(r in rows[0]));
    if (missing.length > 0) {
      errs.push(`Missing required column(s): ${missing.join(", ")}`);
      setErrors(errs);
      return;
    }

    const parsed: ParsedBuilding[] = [];
    rows.forEach((r, idx) => {
      const rowNum = idx + 2; // +1 header, +1 1-index
      const sqftNum = Number(String(r.sqft).replace(/,/g, ""));
      if (!r.address) errs.push(`Row ${rowNum}: missing address`);
      if (!r.city) errs.push(`Row ${rowNum}: missing city`);
      if (!r.state) errs.push(`Row ${rowNum}: missing state`);
      if (!r.zip) errs.push(`Row ${rowNum}: missing zip`);
      if (!Number.isFinite(sqftNum) || sqftNum <= 0) {
        errs.push(`Row ${rowNum}: sqft must be a positive number`);
      }
      parsed.push({
        name: r.name || null,
        address: r.address,
        city: r.city,
        state: (r.state || "").toUpperCase().slice(0, 2),
        zip: r.zip,
        sqft: Number.isFinite(sqftNum) ? sqftNum : 0,
        property_type: r.property_type || null,
      });
    });

    setPreview(parsed);
    setErrors(errs);
  }

  async function handleSubmit() {
    if (!preview || errors.length > 0 || preview.length === 0) return;
    setSubmitting(true);
    setStatus("Uploading...");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("Not signed in.");
      setSubmitting(false);
      return;
    }

    const payload = preview.map((b) => ({ ...b, uploaded_by: user.id }));
    const { error } = await supabase.from("buildings").insert(payload);
    if (error) {
      setStatus(`Error: ${error.message}`);
      setSubmitting(false);
      return;
    }
    setStatus(`Uploaded ${payload.length} buildings.`);
    setSubmitting(false);
    router.push("/portfolio");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="block text-sm font-medium mb-2">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </label>

      {errors.length > 0 && (
        <div className="p-4 rounded-md border border-[var(--danger)] bg-red-50 text-sm">
          <div className="font-medium text-[var(--danger)] mb-1">
            {errors.length} error{errors.length === 1 ? "" : "s"}
          </div>
          <ul className="list-disc list-inside text-[var(--danger)]">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 20 && <li>...and {errors.length - 20} more</li>}
          </ul>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="border border-[var(--border)] rounded-md overflow-hidden">
          <div className="px-4 py-2 bg-[var(--surface-alt)] text-sm font-medium">
            Preview ({preview.length} rows)
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface)] sticky top-0">
                <tr className="text-left border-b border-[var(--border)]">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Zip</th>
                  <th className="px-3 py-2 text-right">Sqft</th>
                  <th className="px-3 py-2">Property type</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((b, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{b.name}</td>
                    <td className="px-3 py-2">{b.address}</td>
                    <td className="px-3 py-2">{b.city}</td>
                    <td className="px-3 py-2">{b.state}</td>
                    <td className="px-3 py-2">{b.zip}</td>
                    <td className="px-3 py-2 text-right">
                      {b.sqft.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{b.property_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 50 && (
            <div className="px-4 py-2 text-xs text-[var(--text-muted)]">
              Showing first 50 of {preview.length}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={
            !preview ||
            preview.length === 0 ||
            errors.length > 0 ||
            submitting
          }
          className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {submitting ? "Uploading..." : "Upload to portfolio"}
        </button>
        {status && (
          <span className="text-sm text-[var(--text-muted)]">{status}</span>
        )}
        {file && (
          <span className="text-xs text-[var(--text-muted)]">{file.name}</span>
        )}
      </div>
    </div>
  );
}
