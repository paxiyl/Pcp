import { useEffect, useState } from "react";

/**
 * "Now", as a value that re-renders its caller.
 *
 * Anything counting down — an ETA, a time remaining — has to read the clock,
 * and reading it in the render body is impure: with the React Compiler on
 * (`reactCompiler` in app.json) the result can be memoised, so the countdown
 * freezes on whatever it said when the screen opened. Holding the time in state
 * and advancing it on a timer makes the read honest and makes the number
 * actually tick.
 */
export const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};
