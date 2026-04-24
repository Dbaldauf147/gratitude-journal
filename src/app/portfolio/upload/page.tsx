import { createServerSupabase } from "@/lib/supabase-server";
import AppHeader from "@/app/AppHeader";
import UploadBuildingsForm from "./UploadBuildingsForm";

export default async function UploadPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen">
      <AppHeader email={user?.email} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-2">Upload portfolio</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Upload a CSV of buildings. Required columns:{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">address</code>,{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">city</code>,{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">state</code>,{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">zip</code>,{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">sqft</code>.
          Optional: <code className="bg-[var(--surface-alt)] px-1 rounded">name</code>,{" "}
          <code className="bg-[var(--surface-alt)] px-1 rounded">property_type</code>.
        </p>
        <div className="mb-6">
          <a
            href="/api/templates/buildings"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Download CSV template
          </a>
        </div>
        <UploadBuildingsForm />
      </div>
    </main>
  );
}
