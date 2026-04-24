export const dynamic = "force-static";

const CSV = `jurisdiction_slug,type,name,citation,sqft_threshold,property_types,first_due,cadence,source_url,notes
nyc-ny,benchmarking,NYC Local Law 84 Benchmarking,NYC Admin Code § 28-309,25000,,2025-05-01,annual,https://www.nyc.gov/site/buildings/codes/benchmarking.page,
nyc-ny,audit,NYC Local Law 87 Energy Audit & RCx,NYC Admin Code § 28-308,50000,,2026-12-31,every 10 years,https://www.nyc.gov/site/buildings/codes/ll87-energy-audits-and-retro-commissioning.page,
nyc-ny,bps,NYC Local Law 97 GHG Limits,NYC Admin Code § 28-320,25000,,2025-05-01,annual (2024-2029 period),https://www.nyc.gov/site/sustainablebuildings/ll97/local-law-97.page,
washington-state,bps,Clean Buildings Performance Standard,RCW 19.27A.210,50000,,2026-06-01,every 5 years,https://www.commerce.wa.gov/growing-the-economy/energy/buildings/,Tier 1 compliance
`;

export function GET() {
  return new Response(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="mandates-template.csv"',
    },
  });
}
