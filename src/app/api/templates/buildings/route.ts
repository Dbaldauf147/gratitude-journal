export const dynamic = "force-static";

const CSV = `name,address,city,state,zip,sqft,property_type
Tower One,123 Main St,New York,NY,10001,125000,Office
Midtown Plaza,500 5th Ave,New York,NY,10110,85000,Office
Fenway Lofts,77 Lansdowne St,Boston,MA,02215,42000,Multifamily
`;

export function GET() {
  return new Response(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="buildings-template.csv"',
    },
  });
}
