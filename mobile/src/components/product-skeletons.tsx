import { View } from "react-native";

import { Skeleton, SkeletonLine } from "./ui/skeleton";

/**
 * Loading shapes for the product catalogue.
 *
 * Each one mirrors the real layout it stands in for — same tile aspect, same
 * two-line name box, same control on the same baseline — so the screen does not
 * visibly rearrange itself the moment data lands. A skeleton that does not match
 * is worse than a spinner, because it promises a layout and then breaks it.
 */

/** One product card placeholder. Matches ProductCard's proportions exactly. */
function ProductCardSkeleton({ width }: { width?: number }) {
  return (
    <View className="gap-2" style={width ? { width } : { flex: 1 }}>
      <Skeleton className="aspect-square w-full rounded-tile" />
      {/* The same 36px the real card reserves, so Add buttons stay on one line. */}
      <View style={{ minHeight: 36 }}>
        <SkeletonLine height={11} width="94%" />
        <View className="h-1.5" />
        <SkeletonLine height={11} width="62%" />
      </View>
      <SkeletonLine height={9} width="44%" />
      <View className="flex-row items-end justify-between">
        <SkeletonLine height={14} width={52} />
        <Skeleton className="rounded-chip" style={{ height: 32, width: 80 }} />
      </View>
    </View>
  );
}

/** Two-column grid: category pages, search results, store shelves. */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View className="flex-row flex-wrap gap-y-5 px-gutter" style={{ columnGap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ width: "47%" }}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/** Horizontal rail: "Popular in Hindaun", "Deals", "Buy again". */
export function ProductRailSkeleton({ cardWidth = 150 }: { cardWidth?: number }) {
  return (
    <View>
      <View className="px-gutter pb-3">
        <SkeletonLine height={16} width={168} />
      </View>
      <View className="flex-row gap-rail px-gutter">
        {[0, 1, 2].map((key) => (
          <ProductCardSkeleton key={key} width={cardWidth} />
        ))}
      </View>
    </View>
  );
}

/** The category strip across the top of Home. */
export function CategoryStripSkeleton() {
  return (
    <View className="flex-row gap-rail px-gutter">
      {[0, 1, 2, 3, 4].map((key) => (
        <View className="items-center gap-2" key={key}>
          <Skeleton className="rounded-tile" style={{ height: 64, width: 64 }} />
          <SkeletonLine height={9} width={48} />
        </View>
      ))}
    </View>
  );
}

/**
 * Store rows. Compact and horizontal, unlike the product card — a store is
 * chosen on name, ETA and distance, not on a photograph.
 */
export function StoreListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="gap-4 px-gutter">
      {Array.from({ length: count }, (_, index) => (
        <View className="flex-row items-center gap-3" key={index}>
          <Skeleton className="rounded-card" style={{ height: 64, width: 64 }} />
          <View className="flex-1 gap-2">
            <SkeletonLine height={14} width="56%" />
            <SkeletonLine height={10} width="78%" />
            <SkeletonLine height={10} width="38%" />
          </View>
        </View>
      ))}
    </View>
  );
}
