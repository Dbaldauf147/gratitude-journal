import type {
  ApplicableMandate,
  Building,
  Jurisdiction,
  Mandate,
  MandateType,
} from "./types";
import { MANDATE_TYPES } from "./types";

// Return every mandate tied to a jurisdiction that matches the building's
// city/state OR state (for state-level jurisdictions), annotated with whether
// the building meets the threshold.
export function screenBuilding(
  building: Building,
  jurisdictions: Jurisdiction[],
  mandates: Mandate[]
): ApplicableMandate[] {
  const buildingCity = building.city.trim().toLowerCase();
  const buildingState = building.state.trim().toUpperCase();

  const matchingJurisdictions = jurisdictions.filter((j) => {
    const jState = j.state.trim().toUpperCase();
    if (jState !== buildingState) return false;
    if (j.level === "state") return true;
    if (j.level === "city" && j.city) {
      return j.city.trim().toLowerCase() === buildingCity;
    }
    // county/other: fall back to city match if present, otherwise skip
    if (j.city) return j.city.trim().toLowerCase() === buildingCity;
    return false;
  });

  const byId = new Map(matchingJurisdictions.map((j) => [j.id, j]));
  const result: ApplicableMandate[] = [];

  for (const m of mandates) {
    const j = byId.get(m.jurisdiction_id);
    if (!j) continue;

    let applies = true;
    const reasons: string[] = [];

    if (m.sqft_threshold != null && building.sqft < m.sqft_threshold) {
      applies = false;
      reasons.push(
        `Below ${m.sqft_threshold.toLocaleString()} sqft threshold (${building.sqft.toLocaleString()} sqft)`
      );
    } else if (m.sqft_threshold != null) {
      reasons.push(
        `Meets ${m.sqft_threshold.toLocaleString()} sqft threshold`
      );
    }

    if (
      m.property_types &&
      m.property_types.length > 0 &&
      building.property_type
    ) {
      const pt = building.property_type.trim().toLowerCase();
      const allowed = m.property_types.map((p) => p.trim().toLowerCase());
      if (!allowed.includes(pt)) {
        applies = false;
        reasons.push(
          `Property type "${building.property_type}" not covered`
        );
      }
    }

    result.push({
      ...m,
      jurisdiction: j,
      applies,
      reason: reasons.join("; "),
    });
  }

  return result;
}

export function groupByType<T extends { type: MandateType }>(
  items: T[]
): Record<MandateType, T[]> {
  const out = {
    benchmarking: [] as T[],
    audit: [] as T[],
    bps: [] as T[],
    utility_data_feed: [] as T[],
  } as Record<MandateType, T[]>;
  for (const t of MANDATE_TYPES) out[t] = [];
  for (const item of items) out[item.type].push(item);
  return out;
}
