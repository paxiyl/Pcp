import { Linking, Platform } from "react-native";

import type { OrderPoint } from "@/lib/api";

/**
 * Opening directions in the phone's own maps app.
 *
 * Deliberately NOT an embedded map. react-native-maps on Android requires a
 * Google Maps SDK key, which requires a billing account with a card on file —
 * and it would be a worse experience anyway. A rider on a bike wants
 * full-screen turn-by-turn with voice and live traffic, which the Maps app
 * does properly and a view inside our app never will.
 */

/** Android's navigation intent: opens turn-by-turn immediately, not a preview. */
const nativeUrl = (destination: string): string | null =>
  Platform.OS === "android" ? `google.navigation:q=${destination}` : null;

/** Works with or without the Maps app installed, on any platform. */
const webUrl = (destination: string): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

/**
 * Coordinates win over the written address: a Hindaun address typed by a
 * customer may not geocode, but a dropped pin always resolves.
 */
const destinationFor = (point?: OrderPoint, address?: string): string | null => {
  if (point) return `${point.lat},${point.lng}`;

  return address?.trim() || null;
};

/**
 * Returns false when there is nothing to navigate to, so the caller can tell
 * the rider why rather than opening an empty map.
 */
export const openDirections = async (
  point?: OrderPoint,
  address?: string,
): Promise<boolean> => {
  const destination = destinationFor(point, address);

  if (!destination) return false;

  const native = nativeUrl(destination);

  if (native) {
    try {
      await Linking.openURL(native);

      return true;
    } catch {
      // No Maps app, or the intent was refused. The web URL below always works,
      // so this is not worth surfacing — canOpenURL would need a manifest
      // queries entry to answer honestly anyway.
    }
  }

  try {
    await Linking.openURL(webUrl(destination));

    return true;
  } catch {
    return false;
  }
};

/** The one-line form of a delivery address, for display and for geocoding. */
export const formatAddress = (address: {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
}): string => [address.line1, address.line2, address.city, address.postcode].filter(Boolean).join(", ");

/** Mean Earth radius, km. */
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Straight-line distance between two points, in km.
 *
 * Not the distance a rider actually travels — Hindaun's lanes make that longer —
 * so it is only ever shown as "about", and never used to price anything.
 */
export const distanceKm = (from: OrderPoint, to: OrderPoint): number => {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** "900 m" below a kilometre, "2.4 km" above it: nobody reads "0.9 km". */
export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.max(Math.round(km * 1000), 50)} m` : `${km.toFixed(1)} km`;
