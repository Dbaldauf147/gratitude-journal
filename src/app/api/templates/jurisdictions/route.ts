export const dynamic = "force-static";

const CSV = `slug,name,level,city,county,state,notes
nyc-ny,"New York City, NY",city,New York,,NY,All 5 boroughs
boston-ma,"Boston, MA",city,Boston,,MA,
washington-dc,"Washington, DC",city,Washington,,DC,
seattle-wa,"Seattle, WA",city,Seattle,,WA,
chicago-il,"Chicago, IL",city,Chicago,,IL,
denver-co,"Denver, CO",city,Denver,,CO,
colorado-state,"Colorado (state)",state,,,CO,Regulation 28
washington-state,"Washington (state)",state,,,WA,Clean Buildings Act
`;

export function GET() {
  return new Response(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="jurisdictions-template.csv"',
    },
  });
}
