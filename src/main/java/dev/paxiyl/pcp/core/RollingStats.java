package dev.paxiyl.pcp.core;

/**
 * Fixed-window rolling statistics with an exponentially weighted mean.
 *
 * <p>Deliberately allocation free after construction: a fight produces a few
 * samples per second and this runs on the client tick thread (including on
 * phones through PojavLauncher), so the window is a small primitive array and
 * derived values are cached until the next push.</p>
 */
public final class RollingStats {

    private final double[] window;
    private final double ewmaAlpha;

    private int head;
    private int count;
    private long totalPushes;

    private double ewma;
    private boolean ewmaSeeded;

    /** Cached derived values, invalidated on every push. */
    private boolean dirty = true;
    private double cachedMean;
    private double cachedVariance;
    private double cachedMin;
    private double cachedMax;

    public RollingStats(int windowSize, double ewmaAlpha) {
        if (windowSize < 1) {
            windowSize = 1;
        }
        this.window = new double[windowSize];
        this.ewmaAlpha = clamp(ewmaAlpha, 0.01D, 1.0D);
    }

    public void push(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return;
        }
        this.window[this.head] = value;
        this.head = (this.head + 1) % this.window.length;
        if (this.count < this.window.length) {
            this.count++;
        }
        this.totalPushes++;
        if (!this.ewmaSeeded) {
            this.ewma = value;
            this.ewmaSeeded = true;
        } else {
            this.ewma = this.ewma + this.ewmaAlpha * (value - this.ewma);
        }
        this.dirty = true;
    }

    public void clear() {
        this.head = 0;
        this.count = 0;
        this.totalPushes = 0L;
        this.ewma = 0.0D;
        this.ewmaSeeded = false;
        this.dirty = true;
    }

    /**
     * Drops half of the stored window. Used when the observed behaviour changes
     * (for example after a server switch) so that the estimate can move to the
     * new regime without throwing away everything that was learned.
     */
    public void decay() {
        int keep = this.count / 2;
        double[] recent = new double[keep];
        for (int i = 0; i < keep; i++) {
            recent[i] = get(this.count - keep + i);
        }
        clear();
        for (int i = 0; i < keep; i++) {
            push(recent[i]);
        }
    }

    /** @param index 0 is the oldest retained sample. */
    public double get(int index) {
        if (index < 0 || index >= this.count) {
            return 0.0D;
        }
        int start = (this.head - this.count + this.window.length) % this.window.length;
        return this.window[(start + index) % this.window.length];
    }

    public int count() {
        return this.count;
    }

    public long totalPushes() {
        return this.totalPushes;
    }

    public boolean isEmpty() {
        return this.count == 0;
    }

    public double ewma() {
        return this.ewmaSeeded ? this.ewma : 0.0D;
    }

    public double mean() {
        recompute();
        return this.cachedMean;
    }

    public double variance() {
        recompute();
        return this.cachedVariance;
    }

    public double stdDev() {
        return Math.sqrt(variance());
    }

    public double min() {
        recompute();
        return this.cachedMin;
    }

    public double max() {
        recompute();
        return this.cachedMax;
    }

    /**
     * Median of the retained window.
     *
     * <p>Sorts a copy, so it is O(n log n) over a window of at most a few
     * dozen values. Called on sample arrival and on overlay composition, never
     * per frame.</p>
     */
    public double median() {
        if (this.count == 0) {
            return 0.0D;
        }
        double[] copy = new double[this.count];
        for (int i = 0; i < this.count; i++) {
            copy[i] = get(i);
        }
        java.util.Arrays.sort(copy);
        int mid = copy.length / 2;
        return copy.length % 2 == 1 ? copy[mid] : (copy[mid - 1] + copy[mid]) / 2.0D;
    }

    /** Value at the given percentile of the window, {@code p} in [0,1]. */
    public double percentile(double p) {
        if (this.count == 0) {
            return 0.0D;
        }
        double[] copy = new double[this.count];
        for (int i = 0; i < this.count; i++) {
            copy[i] = get(i);
        }
        java.util.Arrays.sort(copy);
        double clamped = clamp(p, 0.0D, 1.0D);
        int index = (int) Math.round(clamped * (copy.length - 1));
        return copy[index];
    }

    /**
     * Median absolute deviation, scaled to be comparable with a standard
     * deviation.
     *
     * <p>Combat samples contain genuine outliers that are not noise in the
     * statistical sense - a hit landed while the victim was already falling, a
     * hit someone else also landed, a hit absorbed by an opponent walking into
     * it. A standard deviation squares those and lets one of them dominate the
     * window, which in turn drives any spread-based confidence to zero. The MAD
     * ignores them, so confidence reflects the bulk of the samples.</p>
     */
    public double robustSpread() {
        if (this.count < 2) {
            return 0.0D;
        }
        double med = median();
        double[] deviations = new double[this.count];
        for (int i = 0; i < this.count; i++) {
            deviations[i] = Math.abs(get(i) - med);
        }
        java.util.Arrays.sort(deviations);
        int mid = deviations.length / 2;
        double mad = deviations.length % 2 == 1
                ? deviations[mid]
                : (deviations[mid - 1] + deviations[mid]) / 2.0D;
        return mad * 1.4826D;
    }

    /** Robust analogue of the coefficient of variation, based on the MAD. */
    public double robustCv() {
        double med = Math.abs(median());
        if (med < 1.0E-4D) {
            return 0.0D;
        }
        return robustSpread() / med;
    }

    /** Coefficient of variation; 0 when the mean is ~0 to avoid blowing up. */
    public double coefficientOfVariation() {
        double mean = Math.abs(mean());
        if (mean < 1.0E-4D) {
            return 0.0D;
        }
        return stdDev() / mean;
    }

    /** Last sample pushed, or 0 when empty. */
    public double last() {
        return this.count == 0 ? 0.0D : get(this.count - 1);
    }

    /**
     * How far {@code value} sits from the rolling mean, expressed in standard
     * deviations. Returns 0 while there is not enough data to judge.
     */
    public double zScore(double value) {
        if (this.count < 4) {
            return 0.0D;
        }
        double sd = stdDev();
        if (sd < 1.0E-4D) {
            return 0.0D;
        }
        return (value - mean()) / sd;
    }

    /**
     * Confidence in [0,1] combining sample count against {@code saturation} and
     * the spread of the window. It never reaches 1: a client-side estimate of a
     * server-side rule is always provisional.
     */
    public double confidence(int saturation) {
        return confidenceFrom(this.count, robustCv(), saturation);
    }

    /**
     * The confidence formula, in one place so pooled and per-window confidence
     * cannot drift apart.
     *
     * <p>The spread term uses a coefficient of 1.0 rather than the 2.0 this
     * started with. Measured against a simulated duel, 2.0 combined with a
     * standard-deviation spread held confidence under its own default gate for
     * most of a fight, which meant the modules that depend on it never ran.</p>
     */
    public static double confidenceFrom(int sampleCount, double cv, int saturation) {
        if (sampleCount <= 0) {
            return 0.0D;
        }
        if (saturation < 1) {
            saturation = 1;
        }
        double sampleTerm = (double) sampleCount / (double) (sampleCount + saturation);
        double spreadTerm = 1.0D / (1.0D + Math.max(0.0D, cv));
        return clamp(sampleTerm * spreadTerm, 0.0D, 0.95D);
    }

    private void recompute() {
        if (!this.dirty) {
            return;
        }
        this.dirty = false;
        if (this.count == 0) {
            this.cachedMean = 0.0D;
            this.cachedVariance = 0.0D;
            this.cachedMin = 0.0D;
            this.cachedMax = 0.0D;
            return;
        }
        double sum = 0.0D;
        double lo = Double.MAX_VALUE;
        double hi = -Double.MAX_VALUE;
        for (int i = 0; i < this.count; i++) {
            double v = get(i);
            sum += v;
            if (v < lo) {
                lo = v;
            }
            if (v > hi) {
                hi = v;
            }
        }
        this.cachedMean = sum / this.count;
        double sumSq = 0.0D;
        for (int i = 0; i < this.count; i++) {
            double d = get(i) - this.cachedMean;
            sumSq += d * d;
        }
        this.cachedVariance = this.count > 1 ? sumSq / (this.count - 1) : 0.0D;
        this.cachedMin = lo;
        this.cachedMax = hi;
    }

    public static double clamp(double value, double min, double max) {
        return value < min ? min : (value > max ? max : value);
    }
}
