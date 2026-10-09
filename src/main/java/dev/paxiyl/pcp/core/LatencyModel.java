package dev.paxiyl.pcp.core;

/**
 * Latency bookkeeping, with a hard line between what is measured and what is
 * inferred.
 *
 * <p><b>Own latency (measured).</b> The server reports every player's round
 * trip time in the player-list packet; the client keeps it on
 * {@code NetworkPlayerInfo}. That is a real measurement taken by the server, so
 * it is treated as such - with the caveat that it is refreshed roughly once per
 * second, which is why jitter and trend are tracked rather than one value.</p>
 *
 * <p><b>Hit response (measured, but not a ping).</b> The ticks between sending
 * an attack and seeing the target react is measured locally. It contains our
 * round trip plus server tick granularity, so it is reported separately and
 * never presented as the opponent's ping.</p>
 *
 * <p><b>Opponent latency (measured only if exposed, otherwise estimated).</b>
 * If the opponent appears in the player list with a plausible response time,
 * that value is server-reported and flagged as measured. Many servers hide,
 * zero or fake it, so a sanity check runs first. Failing that, an estimate is
 * derived from how often their position updates arrive - clearly flagged as an
 * estimate with its own confidence. No value is ever invented.</p>
 */
public final class LatencyModel {

    public static final int MS_PER_TICK = 50;

    private static final int WINDOW = 20;
    /** A jump this many ms above the rolling mean counts as a spike. */
    private static final int SPIKE_MS = 120;
    private static final int SPIKE_HOLD_TICKS = 40;

    private final RollingStats ownPing = new RollingStats(WINDOW, 0.3D);
    private final RollingStats ownPingShort = new RollingStats(4, 0.5D);
    private final RollingStats hitResponseTicks = new RollingStats(16, 0.3D);
    private final RollingStats opponentPing = new RollingStats(WINDOW, 0.3D);
    private final RollingStats opponentUpdateGap = new RollingStats(WINDOW, 0.3D);

    private int lastOwnPing = -1;
    private long spikeUntilTick = -1L;
    private long lastOwnSampleTick = -1L;
    private boolean opponentPingExposed;

    // ------------------------------------------------------------------
    // Own latency
    // ------------------------------------------------------------------

    /**
     * @param pingMs server-reported round trip in milliseconds
     * @param tick   current client tick, used for spike hold-off
     */
    public void recordOwnPing(int pingMs, long tick) {
        // Servers send 0 before the first keep-alive round trip completes and
        // some proxies send nonsense; neither is a measurement.
        if (pingMs <= 0 || pingMs > 5000) {
            return;
        }
        if (this.ownPing.count() >= 4 && pingMs - this.ownPing.mean() > SPIKE_MS) {
            this.spikeUntilTick = tick + SPIKE_HOLD_TICKS;
        }
        this.lastOwnPing = pingMs;
        this.ownPing.push(pingMs);
        this.ownPingShort.push(pingMs);
        this.lastOwnSampleTick = tick;
    }

    /** Last server-reported ping, or -1 when nothing has been reported yet. */
    public int ownPingMs() {
        return this.lastOwnPing;
    }

    public boolean hasOwnPing() {
        return this.lastOwnPing > 0;
    }

    /** Standard deviation of recent pings in ms: our jitter measure. */
    public double ownJitterMs() {
        return this.ownPing.stdDev();
    }

    /** Recent mean minus window mean; positive means latency is climbing. */
    public double ownTrendMs() {
        if (this.ownPingShort.count() == 0 || this.ownPing.count() < 4) {
            return 0.0D;
        }
        return this.ownPingShort.mean() - this.ownPing.mean();
    }

    public boolean spiking(long tick) {
        return tick <= this.spikeUntilTick;
    }

    /**
     * True when the latency picture is too thin or too unstable to time
     * movement against. Callers suspend automation rather than guess.
     */
    public boolean unreliable(long tick) {
        if (!hasOwnPing() || this.ownPing.count() < 3) {
            return true;
        }
        if (spiking(tick)) {
            return true;
        }
        // Player-list updates stopped arriving: the connection is probably sick.
        if (this.lastOwnSampleTick >= 0L && tick - this.lastOwnSampleTick > 200L) {
            return true;
        }
        return ownJitterMs() > 150.0D;
    }

    /**
     * Timing slack to leave in every window, in ticks. Built from jitter and
     * the current trend rather than raw ping: a steady 200 ms link is easier to
     * time against than a 60 ms link that swings by 80 ms.
     */
    public double uncertaintyTicks() {
        double jitter = ownJitterMs();
        double trend = Math.abs(ownTrendMs());
        double ms = jitter + 0.5D * trend;
        if (!hasOwnPing()) {
            // Nothing measured: assume one tick of slack, no more.
            return 1.0D;
        }
        return RollingStats.clamp(ms / MS_PER_TICK, 0.0D, 4.0D);
    }

    /** Our ping expressed in ticks, for reasoning about hit registration. */
    public double ownPingTicks() {
        return hasOwnPing() ? (double) this.lastOwnPing / MS_PER_TICK : -1.0D;
    }

    // ------------------------------------------------------------------
    // Hit response (locally measured)
    // ------------------------------------------------------------------

    public void recordHitResponse(int ticks) {
        if (ticks >= 0 && ticks <= 20) {
            this.hitResponseTicks.push(ticks);
        }
    }

    /** Measured ticks from attack to visible reaction, or -1 if unmeasured. */
    public double hitResponseTicks() {
        return this.hitResponseTicks.count() == 0 ? -1.0D : this.hitResponseTicks.ewma();
    }

    public int hitResponseSamples() {
        return this.hitResponseTicks.count();
    }

    // ------------------------------------------------------------------
    // Opponent latency
    // ------------------------------------------------------------------

    /**
     * Feeds an opponent ping taken from the player list.
     *
     * @param pingMs value the server published for that player
     * @return true when the value passed the plausibility check and was used
     */
    public boolean recordOpponentPing(int pingMs) {
        // 0 and the sentinel values servers use for "hidden" are not pings, and
        // neither is anything past a plausible transoceanic round trip.
        if (pingMs <= 0 || pingMs > 3000) {
            this.opponentPingExposed = false;
            return false;
        }
        this.opponentPingExposed = true;
        this.opponentPing.push(pingMs);
        return true;
    }

    public void clearOpponent() {
        this.opponentPing.clear();
        this.opponentUpdateGap.clear();
        this.opponentPingExposed = false;
    }

    /** True when the server actually exposes the opponent's ping. */
    public boolean opponentPingMeasured() {
        return this.opponentPingExposed && this.opponentPing.count() > 0;
    }

    /** Server-reported opponent ping, or -1 when not exposed. */
    public double opponentPingMs() {
        return opponentPingMeasured() ? this.opponentPing.ewma() : -1.0D;
    }

    /**
     * Records the gap, in ticks, between two position updates for the opponent.
     * Used only for the fallback estimate below.
     */
    public void recordOpponentUpdateGap(int ticks) {
        if (ticks > 0 && ticks <= 40) {
            this.opponentUpdateGap.push(ticks);
        }
    }

    /**
     * Rough opponent-latency estimate derived from position-update spacing, in
     * milliseconds. This is an <em>estimate</em>, not a ping: it mixes their
     * real latency with server send-rate and packet loss. Returns -1 when there
     * is not enough data.
     */
    public double opponentLatencyEstimateMs() {
        if (this.opponentUpdateGap.count() < 4) {
            return -1.0D;
        }
        // A well connected player moving continuously produces an update
        // roughly every tick. Extra spacing is treated as delay, halved
        // because part of any gap is simply the server batching.
        double gap = this.opponentUpdateGap.ewma();
        double excess = Math.max(0.0D, gap - 1.0D);
        return excess * MS_PER_TICK * 0.5D;
    }

    public double opponentEstimateConfidence() {
        return this.opponentUpdateGap.confidence(8);
    }

    /**
     * Single human-readable opponent latency line for the overlay, with its
     * provenance spelled out.
     */
    public String describeOpponentLatency() {
        if (opponentPingMeasured()) {
            return String.format("%.0fms (server-reported)", opponentPingMs());
        }
        double est = opponentLatencyEstimateMs();
        if (est < 0.0D) {
            return "unknown (not exposed, too few samples)";
        }
        return String.format("~%.0fms est conf%.0f%%", est, opponentEstimateConfidence() * 100.0D);
    }

    public String describeOwnLatency() {
        if (!hasOwnPing()) {
            return "unknown";
        }
        return String.format("%dms +/-%.0f (measured)", this.lastOwnPing, ownJitterMs());
    }

    public void reset() {
        this.ownPing.clear();
        this.ownPingShort.clear();
        this.hitResponseTicks.clear();
        clearOpponent();
        this.lastOwnPing = -1;
        this.spikeUntilTick = -1L;
        this.lastOwnSampleTick = -1L;
    }
}
