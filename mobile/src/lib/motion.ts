import {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from "react-native-reanimated";

/**
 * Raket motion language.
 *
 * One rule decides everything here: motion explains a change, it does not
 * decorate one. Entrances are short, exits are shorter, and anything the finger
 * drives uses a spring so it can be interrupted mid-flight.
 *
 * Reduce Motion is honoured by presenting the final state immediately. Feedback
 * that carries meaning — a haptic, a count changing — still fires.
 */

/* --- Durations. Page-level motion stays under a quarter second. --- */
export const DURATION = {
  /** Page and sheet content arriving. */
  enter: 220,
  /** Exits are faster than entrances so a dismissal feels decisive. */
  exit: 150,
  /** Route container cross-fade. */
  page: 200,
  /** Colour and opacity changes on a control. */
  state: 140,
} as const;

/**
 * Springs. Tuned so a quantity stepper settles in roughly 300ms with no
 * visible overshoot, and a sheet lands with just enough weight to feel physical.
 */
export const SPRING = {
  /** Default for layout and transform changes. */
  standard: { damping: 30, mass: 1, stiffness: 420 },
  /** Steppers, badges, cart count — must feel instant. */
  snappy: { damping: 32, mass: 0.8, stiffness: 500 },
  /** Sheets, drawers, the floating cart bar. Carries a little more weight. */
  gentle: { damping: 28, mass: 1, stiffness: 350 },
} as const satisfies Record<string, WithSpringConfig>;

/** Press feedback. Buttons compress slightly; rows use opacity instead. */
export const PRESS_SCALE = {
  /** Large surfaces: cards, tiles, banners. */
  card: 0.985,
  /** Controls: buttons, steppers, chips. */
  control: 0.97,
} as const;

/** Spring for press-in/press-out. Fast enough that a tap never feels laggy. */
export const PRESS_SPRING: WithSpringConfig = { damping: 22, mass: 0.5, stiffness: 600 };

export const TIMING: WithTimingConfig = { duration: DURATION.state };

/**
 * One entrance for a whole surface: a single short fade applied to every block at
 * once, so a screen never assembles itself piece by piece in front of the reader.
 */
export function useEnter() {
  const reduceMotion = useReducedMotion();

  return () => (reduceMotion ? FadeIn.duration(0) : FadeIn.duration(DURATION.enter));
}

/**
 * Entrance for content that arrives after its container is already on screen —
 * a results list, a rail that finished loading. Travels 12px so the eye catches
 * the arrival without the layout appearing to jump.
 */
export function useContentEnter() {
  const reduceMotion = useReducedMotion();

  return (delay = 0) =>
    reduceMotion
      ? FadeIn.duration(0)
      : FadeInDown.duration(DURATION.enter).delay(delay).springify().damping(30).stiffness(420);
}

/** Exit for a removed row or a dismissed card. */
export function useContentExit() {
  const reduceMotion = useReducedMotion();

  return () => (reduceMotion ? FadeOut.duration(0) : FadeOut.duration(DURATION.exit));
}

/**
 * Layout transition for lists that reorder or shrink — a basket losing a row,
 * a stepper replacing an Add button. Reanimated reads ReduceMotion itself here.
 */
export const layoutTransition = LinearTransition.springify()
  .damping(SPRING.standard.damping)
  .stiffness(SPRING.standard.stiffness)
  .reduceMotion(ReduceMotion.System);

/**
 * Resolves a spring config against the user's Reduce Motion setting. Reanimated
 * applies the final value immediately when the system flag is on.
 */
export function springConfig(preset: keyof typeof SPRING = "standard"): WithSpringConfig {
  return { ...SPRING[preset], reduceMotion: ReduceMotion.System };
}
