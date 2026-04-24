export type MandateType =
  | "benchmarking"
  | "audit"
  | "bps"
  | "utility_data_feed";

export const MANDATE_TYPES: MandateType[] = [
  "benchmarking",
  "audit",
  "bps",
  "utility_data_feed",
];

export const MANDATE_LABELS: Record<MandateType, string> = {
  benchmarking: "Benchmarking",
  audit: "Audit / RCx",
  bps: "BPS",
  utility_data_feed: "Utility Data Feed",
};

export type Jurisdiction = {
  id: string;
  slug: string;
  name: string;
  level: "state" | "county" | "city" | "other";
  city: string | null;
  county: string | null;
  state: string;
  notes: string | null;
};

export type Mandate = {
  id: string;
  jurisdiction_id: string;
  type: MandateType;
  name: string;
  citation: string | null;
  sqft_threshold: number | null;
  property_types: string[] | null;
  first_due: string | null;
  cadence: string | null;
  source_url: string | null;
  notes: string | null;
};

export type Building = {
  id: string;
  name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  sqft: number;
  property_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ApplicableMandate = Mandate & {
  jurisdiction: Jurisdiction;
  applies: boolean;
  reason: string;
};
