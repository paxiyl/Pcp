import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useCSSVariable } from "uniwind";

import type { Order, OrderPoint } from "@/lib/api";

/** Keeps the pins clear of the map edges once the route is framed. */
const EDGE_PADDING = { bottom: 90, left: 70, right: 70, top: 70 };

/** Street-level view for an order with only one known point. */
const SINGLE_POINT_DELTA = 0.006;

const region = (points: OrderPoint[]) => {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // A small margin only; fitToCoordinates tightens this once the map is ready.
  return {
    latitude: (minLat + maxLat) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, SINGLE_POINT_DELTA),
    longitude: (minLng + maxLng) / 2,
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, SINGLE_POINT_DELTA),
  };
};

const Pin = ({ color, icon }: { color: string; icon: keyof typeof Ionicons.glyphMap }) => (
  <View
    className="items-center justify-center rounded-pill border-2 border-white"
    style={{ backgroundColor: color, height: 34, width: 34 }}
  >
    <Ionicons color="#ffffff" name={icon} size={18} />
  </View>
);

/**
 * Restaurant, courier and destination on one map. Everything drawn here comes
 * from coordinates stored on the order; nothing is invented when a point is
 * missing, so the map degrades to a message rather than a fictional route.
 */
export function OrderRouteMap({ order }: { order: Order }) {
  const mapRef = useRef<MapView>(null);
  const [primary, subtle] = useCSSVariable(["--color-primary", "--color-subtle-foreground"]);

  const pickup = order.restaurantLocation;
  const dropoff = order.deliveryLocation;
  const courier = order.driver?.location;

  const points = [pickup, courier, dropoff].filter((point): point is OrderPoint => Boolean(point));

  if (points.length === 0) {
    return (
      <View className="mx-5 flex-1 items-center justify-center gap-2 rounded-card bg-muted p-6">
        <Ionicons color={subtle as string} name="map-outline" size={32} />
        <Text className="text-center font-heading text-body text-foreground">
          No map for this order
        </Text>
        <Text className="text-center font-sans text-label text-muted-foreground">
          This order was placed before pickup and delivery coordinates were recorded.
        </Text>
      </View>
    );
  }

  const coordinates = points.map((point) => ({ latitude: point.lat, longitude: point.lng }));

  return (
    <MapView
      initialRegion={region(points)}
      // Frame the pins as tightly as the viewport allows, so a short hop across
      // one neighbourhood fills the map instead of sitting in a wide city view.
      onMapReady={() =>
        coordinates.length > 1 &&
        mapRef.current?.fitToCoordinates(coordinates, {
          animated: false,
          edgePadding: EDGE_PADDING,
        })
      }
      pitchEnabled={false}
      provider={PROVIDER_GOOGLE}
      ref={mapRef}
      rotateEnabled={false}
      style={{ flex: 1 }}
      toolbarEnabled={false}
    >
      {pickup ? (
        <Marker
          coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
          title={order.restaurantName}
        >
          <Pin color="#102a2a" icon="restaurant" />
        </Marker>
      ) : null}

      {courier ? (
        <Marker
          coordinate={{ latitude: courier.lat, longitude: courier.lng }}
          title={order.driver?.name ?? "Courier"}
        >
          <Pin color={primary as string} icon="bicycle" />
        </Marker>
      ) : null}

      {dropoff ? (
        <Marker
          coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
          title="Your address"
        >
          <Pin color={primary as string} icon="home" />
        </Marker>
      ) : null}

      {/* A straight leg, not a driven route: no routing service is wired up yet. */}
      {coordinates.length > 1 ? (
        <Polyline coordinates={coordinates} strokeColor={primary as string} strokeWidth={4} />
      ) : null}
    </MapView>
  );
}
