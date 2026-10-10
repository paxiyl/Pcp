import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Order, OrderPoint } from "@/lib/api";
import { distanceKm, formatAddress, formatDistance, openDirections } from "@/lib/navigation";
import { toast } from "@/lib/sonner";

/** Height of the line joining one stop to the next. */
const LEG_HEIGHT = 26;

const Dot = ({
  color,
  filled,
  icon,
}: {
  color: string;
  filled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) => (
  <View
    className="items-center justify-center rounded-pill border-2"
    style={{
      backgroundColor: filled ? color : "transparent",
      borderColor: color,
      height: 34,
      width: 34,
    }}
  >
    <Ionicons color={filled ? "#ffffff" : color} name={icon} size={17} />
  </View>
);

const Leg = ({ color }: { color: string }) => (
  <View className="w-[34px] items-center">
    <View style={{ backgroundColor: color, height: LEG_HEIGHT, opacity: 0.35, width: 2 }} />
  </View>
);

const Stop = ({
  address,
  color,
  filled = false,
  icon,
  label,
  meta,
  title,
}: {
  address?: string;
  color: string;
  filled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta?: string;
  title: string;
}) => (
  <View className="flex-row items-start gap-3">
    <Dot color={color} filled={filled} icon={icon} />

    <View className="flex-1 pt-0.5">
      <View className="flex-row items-center gap-2">
        <Text className="font-heading text-caption uppercase tracking-wide" style={{ color }}>
          {label}
        </Text>
        {meta ? (
          <Text className="font-sans text-caption text-muted-foreground">· {meta}</Text>
        ) : null}
      </View>

      <Text className="font-heading text-body text-foreground">{title}</Text>
      {address ? (
        <Text className="font-sans text-label text-muted-foreground">{address}</Text>
      ) : null}
    </View>
  </View>
);

/**
 * The route as a card, not an embedded map.
 *
 * react-native-maps renders a grey rectangle unless the build carries a billed
 * Google Maps SDK key, and a map the size of a phone card was never the useful
 * part anyway: what a customer wants to know is where the food is coming from,
 * where the rider is now, and how far that is. Tapping the card hands the route
 * to the Maps app, which does the part a map is actually good at.
 *
 * Nothing here is invented. A missing coordinate removes a line rather than
 * guessing one.
 */
export function OrderRouteCard({ order }: { order: Order }) {
  const [primary, subtle, foreground] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-foreground",
  ]);

  const pickup = order.restaurantLocation;
  const dropoff = order.deliveryLocation;
  const courier = order.driver?.location;

  const dropoffAddress = formatAddress(order.deliveryAddress);

  // Where the rider has got to, rather than how long the whole trip is: the
  // remaining leg is the only number that changes while the screen is open.
  const remaining: OrderPoint | undefined = courier && dropoff ? courier : undefined;
  const courierMeta = remaining
    ? `${formatDistance(distanceKm(remaining, dropoff as OrderPoint))} away`
    : order.driver?.locationUpdatedAt
      ? "Location last seen"
      : undefined;

  const tripMeta =
    pickup && dropoff ? `${formatDistance(distanceKm(pickup, dropoff))} trip` : undefined;

  const openRoute = async () => {
    const opened = await openDirections(dropoff, dropoffAddress);

    if (!opened) {
      toast.error("No route to open", {
        description: "This order has no delivery location saved yet.",
      });
    }
  };

  return (
    <View className="mx-5 flex-1 justify-between gap-4 rounded-card border border-border bg-card p-4">
      <View className="gap-0">
        <Stop
          address={order.restaurantAddress}
          color={foreground as string}
          icon={order.vendorKind === "store" ? "storefront" : "restaurant"}
          label="Picked up from"
          meta={tripMeta}
          title={order.restaurantName}
        />

        <Leg color={foreground as string} />

        {courier ? (
          <>
            <Stop
              color={primary as string}
              filled
              icon="bicycle"
              label="Rider"
              meta={courierMeta}
              title={order.driver?.name ?? "On the way"}
            />
            <Leg color={primary as string} />
          </>
        ) : null}

        <Stop
          address={order.deliveryAddress.instructions}
          color={primary as string}
          filled
          icon="home"
          label="Delivering to"
          title={dropoffAddress}
        />
      </View>

      <Pressable
        accessibilityLabel="Open the delivery address in Maps"
        accessibilityRole="button"
        className="h-12 flex-row items-center justify-center gap-2 rounded-input border border-border active:bg-muted"
        onPress={openRoute}
      >
        <Ionicons color={subtle as string} name="navigate-outline" size={18} />
        <Text className="font-heading text-label text-foreground">Open in Maps</Text>
      </Pressable>
    </View>
  );
}
