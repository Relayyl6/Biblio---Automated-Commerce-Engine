// core/logistics/src/geocodingUtils.ts
//
// Geocoding & Centroid Coordinate Resolver for Nigerian Logistics.
// Provides fast, offline coordinate resolution for Nigerian cities and hubs.
// Prevents courier API rejections (HTTP 422/500) caused by missing lat/lng.

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

const NIGERIAN_CENTROIDS: Record<string, GeoCoordinates> = {
  // Lagos Hubs
  "ikeja": { latitude: 6.5966, longitude: 3.3431 },
  "lagos island": { latitude: 6.4549, longitude: 3.4246 },
  "victoria island": { latitude: 6.4281, longitude: 3.4219 },
  "lekki": { latitude: 6.4698, longitude: 3.5852 },
  "ajah": { latitude: 6.4667, longitude: 3.5667 },
  "yaba": { latitude: 6.5095, longitude: 3.3711 },
  "surulere": { latitude: 6.4969, longitude: 3.3578 },
  "festac": { latitude: 6.4667, longitude: 3.2833 },
  "ikorodu": { latitude: 6.6194, longitude: 3.5105 },
  "oshodi": { latitude: 6.5569, longitude: 3.3458 },
  "alaba": { latitude: 6.4628, longitude: 3.1906 },
  "apapa": { latitude: 6.4474, longitude: 3.3587 },
  "maryland": { latitude: 6.5739, longitude: 3.3667 },
  "gbagada": { latitude: 6.5562, longitude: 3.3872 },
  "agege": { latitude: 6.6180, longitude: 3.3209 },
  "lagos": { latitude: 6.5244, longitude: 3.3792 },

  // Abuja & FCT
  "maitama": { latitude: 9.0882, longitude: 7.4934 },
  "wuse": { latitude: 9.0667, longitude: 7.4667 },
  "garki": { latitude: 9.0333, longitude: 7.4833 },
  "asokoro": { latitude: 9.0441, longitude: 7.5248 },
  "gwarinpa": { latitude: 9.1099, longitude: 7.3827 },
  "abuja": { latitude: 9.0765, longitude: 7.3986 },
  "fct": { latitude: 9.0765, longitude: 7.3986 },

  // Other Major Commercial Centers
  "port harcourt": { latitude: 4.8156, longitude: 7.0498 },
  "ibadan": { latitude: 7.3775, longitude: 3.9470 },
  "kano": { latitude: 12.0022, longitude: 8.5919 },
  "benin": { latitude: 6.3350, longitude: 5.6037 },
  "enugu": { latitude: 6.4584, longitude: 7.5464 },
  "abeokuta": { latitude: 7.1557, longitude: 3.3451 },
  "asaba": { latitude: 6.1983, longitude: 6.7333 },
  "warri": { latitude: 5.5167, longitude: 5.7500 },
  "calabar": { latitude: 4.9757, longitude: 8.3417 },
  "kaduna": { latitude: 10.5105, longitude: 7.4165 },
};

const DEFAULT_COORDINATES: GeoCoordinates = { latitude: 6.5244, longitude: 3.3792 }; // Lagos Central

/**
 * Resolves address text or structured address to geographical coordinates.
 * Supports direct lat/lng objects, comma-separated coordinates, and Nigerian city/hub centroids.
 * Guarantees valid coordinates are always returned (prevents HTTP 422 courier rejections).
 */
export function resolveCoordinates(
  address:
    | string
    | {
        street?: string;
        city?: string;
        state?: string;
        latitude?: number | string;
        longitude?: number | string;
        lat?: number | string;
        lng?: number | string;
        coordinates?: { latitude?: number | string; longitude?: number | string };
      }
    | null
    | undefined
): GeoCoordinates {
  if (!address) return DEFAULT_COORDINATES;

  // 1. Direct coordinate check on structured object
  if (typeof address === "object") {
    const rawLat = address.latitude ?? address.lat ?? address.coordinates?.latitude;
    const rawLng = address.longitude ?? address.lng ?? address.coordinates?.longitude;
    if (rawLat !== undefined && rawLng !== undefined) {
      const lat = Number(rawLat);
      const lng = Number(rawLng);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  // 2. Comma-separated lat, lng in string format: "6.4531, 3.4219"
  if (typeof address === "string") {
    const latLngMatch = address.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (latLngMatch) {
      const lat = Number(latLngMatch[1]);
      const lng = Number(latLngMatch[3]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  // 3. Keyword / Centroid matching
  const textToSearch = typeof address === "string"
    ? address.toLowerCase()
    : `${address.street || ""} ${address.city || ""} ${address.state || ""}`.toLowerCase();

  for (const [key, coords] of Object.entries(NIGERIAN_CENTROIDS)) {
    if (textToSearch.includes(key)) {
      return coords;
    }
  }

  return DEFAULT_COORDINATES;
}
