import { Image, type ImageSource } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

export type Banner = {
  /** Read aloud in place of the artwork, which carries the offer as pixels. */
  label: string;
  onPress: () => void;
  source: ImageSource;
};

/** All banner artwork shares this ratio, so one height fits every slide. */
const ASPECT_RATIO = 2.99;
const AUTO_ADVANCE_MS = 5000;
/** Three copies: one to scroll back into, one shown, one to scroll forward into. */
const COPIES = 3;

type Props = { banners: Banner[]; width: number };

/**
 * Infinite banner carousel. The list is tripled and the scroll position is
 * silently recentred whenever it reaches a copy boundary, so swiping never hits
 * an end in either direction.
 */
export function BannerCarousel({ banners, width }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [primary, border] = useCSSVariable(["--color-primary", "--color-border"]);
  const [index, setIndex] = useState(banners.length);
  const interacting = useRef(false);

  const height = Math.round(width / ASPECT_RATIO);
  const slides = Array.from({ length: COPIES }, () => banners).flat();
  const middle = banners.length;

  const scrollTo = (next: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ animated, x: next * width, y: 0 });
    setIndex(next);
  };

  // Start on the middle copy so there is room to scroll both ways immediately.
  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, x: middle * width, y: 0 });
  }, [middle, width]);

  useEffect(() => {
    if (banners.length < 2) return;

    const timer = setInterval(() => {
      if (interacting.current) return;

      setIndex((current) => {
        const next = current + 1;
        scrollRef.current?.scrollTo({ animated: true, x: next * width, y: 0 });

        return next;
      });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [banners.length, width]);

  /** Jump back to the equivalent slide in the middle copy, without animating. */
  const recentre = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const settled = Math.round(event.nativeEvent.contentOffset.x / width);

    if (settled < middle || settled >= middle * 2) {
      scrollTo((settled % banners.length) + middle, false);

      return;
    }

    setIndex(settled);
  };

  if (banners.length === 0) return null;

  const active = ((index % banners.length) + banners.length) % banners.length;

  return (
    <View>
      <ScrollView
        decelerationRate="fast"
        horizontal
        onMomentumScrollEnd={recentre}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onScrollEndDrag={() => {
          interacting.current = false;
        }}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        style={{ width }}
      >
        {slides.map((banner, slideIndex) => (
          <Pressable
            accessibilityLabel={banner.label}
            accessibilityRole="button"
            className="active:opacity-90"
            key={`${banner.label}-${slideIndex}`}
            onPress={banner.onPress}
            style={{ width }}
          >
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={banner.source}
              style={{ borderRadius: 16, height, width }}
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>

      {banners.length > 1 ? (
        <View className="mt-3 flex-row items-center justify-center gap-2">
          {banners.map((banner, dotIndex) => (
            <View
              className="h-2 rounded-pill"
              key={banner.label}
              style={{
                backgroundColor: dotIndex === active ? (primary as string) : (border as string),
                width: dotIndex === active ? 18 : 8,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
