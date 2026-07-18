import { NextResponse } from "next/server";

// Always run on the current deployment's function, never cached, so the value
// reflects whatever build is live right now.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { id: process.env.VERCEL_URL || "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
