package dev.paxiyl.pcp.core;

/**
 * The decision core: owns the learned profile, the latency model, the state
 * machine and the two planners, and is driven one tick at a time by the client
 * layer.
 *
 * <p>No Minecraft types appear here or anywhere else in this package, so a test
 * can drive a whole fight by handing it {@link CombatSnapshot}s.</p>
 */
public final class CombatBrain {

    private final CoreSettings settings;
    private final KnockbackProfile knockback = new KnockbackProfile();
    private final LatencyModel latency = new LatencyModel();
    private final FightStateMachine stateMachine = new FightStateMachine();
    private final SpacingModel spacing = new SpacingModel();
    private final TapPlanner tapPlanner = new TapPlanner();
    private final TradeDecider tradeDecider = new TradeDecider();
    private final DecisionLog log = new DecisionLog(10);

    private FightState state = FightState.IDLE;
    private SpacingZone zone = SpacingZone.OUT_OF_RANGE;
    private MovementPlan plan = new MovementPlan();
    private boolean suspended;
    private long lastTick;

    public CombatBrain(CoreSettings settings) {
        this.settings = settings == null ? new CoreSettings() : settings;
    }

    public void update(CombatSnapshot s) {
        this.lastTick = s.tick;
        this.knockback.setLearningRate(this.settings.learningRate());

        this.zone = this.spacing.classify(s, this.settings, this.knockback);

        FightState previous = this.state;
        this.state = this.stateMachine.update(s, this.settings, this.zone);
        if (this.state != previous) {
            this.log.add(s.tick, this.state.label() + " <- " + this.stateMachine.reason());
        }

        this.plan = this.tapPlanner.plan(s, this.settings, this.knockback, this.state, this.zone, this.suspended);
        if (this.plan.isActive()) {
            this.log.add(s.tick, this.plan.action.label() + " " + this.plan.durationTicks + "t: " + this.plan.reason);
        }
    }

    /** Asked by the attack gate every time the player requests an attack. */
    public TradeAdvice adviseAttack(CombatSnapshot s, boolean manualOverride) {
        TradeAdvice advice = this.tradeDecider.decide(s, this.settings, this.knockback,
                this.state, this.zone, this.plan, this.suspended, manualOverride);
        if (advice.holds()) {
            this.log.add(s.tick, "hold " + advice.delayTicks + "t: " + advice.reason);
        }
        return advice;
    }

    public void recordKnockback(KnockbackObservation observation) {
        this.knockback.record(observation);
        if (observation != null) {
            this.log.add(this.lastTick, "learned " + observation.toString());
        }
    }

    public void onActionStarted(MoveAction action, int durationTicks, long tick) {
        this.tapPlanner.onActionStarted(action, durationTicks, tick);
    }

    /** Clears per-fight state. Keeps the learned profile. */
    public void resetFight(String why) {
        this.stateMachine.reset(why);
        this.tapPlanner.reset();
        this.state = FightState.IDLE;
        this.zone = SpacingZone.OUT_OF_RANGE;
        this.plan.clear(why == null ? "reset" : why);
        this.latency.clearOpponent();
        this.log.add(this.lastTick, "fight reset: " + why);
    }

    public void setSuspended(boolean suspended, String why) {
        if (this.suspended != suspended) {
            this.log.add(this.lastTick, suspended ? ("suspended: " + why) : ("resumed: " + why));
        }
        this.suspended = suspended;
    }

    public boolean suspended() {
        return this.suspended;
    }

    public CoreSettings settings() {
        return this.settings;
    }

    public KnockbackProfile knockback() {
        return this.knockback;
    }

    public LatencyModel latency() {
        return this.latency;
    }

    public FightState state() {
        return this.state;
    }

    public String stateReason() {
        return this.stateMachine.reason();
    }

    public int ticksInState(long tick) {
        return this.stateMachine.ticksInState(tick);
    }

    public SpacingZone zone() {
        return this.zone;
    }

    public String zoneRationale() {
        return this.spacing.rationale();
    }

    public MovementPlan plan() {
        return this.plan;
    }

    public SpacingModel spacing() {
        return this.spacing;
    }

    public TapPlanner tapPlanner() {
        return this.tapPlanner;
    }

    public TradeDecider tradeDecider() {
        return this.tradeDecider;
    }

    public DecisionLog log() {
        return this.log;
    }
}
