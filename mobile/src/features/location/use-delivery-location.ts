import * as Location from "expo-location";
import { useCallback, useState } from "react";

export type ResolvedAddress = {
  line1: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

type Status = "idle" | "requesting" | "resolved" | "denied" | "error";

const formatLine1 = (place: Location.LocationGeocodedAddress) =>
  [place.streetNumber, place.street].filter(Boolean).join(" ") || place.name || "Current location";

export function useDeliveryLocation() {
  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<ResolvedAddress | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus("requesting");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setStatus("denied");
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const resolved: ResolvedAddress = {
        line1: place ? formatLine1(place) : "Current location",
        city: place?.city ?? place?.subregion ?? "",
        postcode: place?.postalCode ?? "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setAddress(resolved);
      setStatus("resolved");

      return resolved;
    } catch {
      setStatus("error");
      return null;
    }
  }, []);

  return { address, requestLocation, status };
}
