package dev.paxiyl.pcp.client;

import java.io.File;

import dev.paxiyl.pcp.config.PcpConfig;
import dev.paxiyl.pcp.config.PcpConfigScreen;
import dev.paxiyl.pcp.core.CombatBrain;
import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.KnockbackProfile;
import dev.paxiyl.pcp.core.LatencyModel;
import dev.paxiyl.pcp.core.MoveAction;
import dev.paxiyl.pcp.core.MovementPlan;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;
import net.minecraftforge.client.event.RenderGameOverlayEvent;
import net.minecraftforge.event.world.WorldEvent;
import net.minecraftforge.fml.common.gameevent.InputEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import net.minecraftforge.fml.common.network.FMLNetworkEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;

/**
 * Client-side hub: owns the per-tick pipeline and every Forge event handler.
 *
 * <p>Ordering per tick matters and is deliberate. The decision pass runs at the
 * <em>end</em> of the client tick, after {@code theWorld.updateEntities()} has
 * applied this tick's positions, hurt timers and knockback velocities, so the
 * snapshot describes what really just happened. The resulting override is read
 * on the next tick when {@code EntityPlayerSP.onLivingUpdate()} asks the
 * movement input for its state - a one-tick turnaround, which is the best
 * available without rewriting vanilla methods.</p>
 *
 * <p>The attack gate runs instead from the input events, which fire earlier in
 * the same tick than the vanilla click loop, so a passed-through attack keeps
 * its original tick.</p>
 */
public final class PcpClient {

    /** How often the learned profile is written out while playing. */
    private static final int PROFILE_SAVE_INTERVAL_TICKS = 1200;

    private final PcpConfig config;
    private final CoreSettings settings;
    private final CombatBrain brain;
    private final CombatSnapshot snapshot = new CombatSnapshot();
    private final MovementController movement;
    private final TargetTracker tracker;
    private final HitObserver hits = new HitObserver();
    private final LatencyMonitor latency;
    private final AttackGate gate;
    private final SafetyGuard guard = new SafetyGuard();
    private final DebugOverlay overlay;
    private final ProfileStore profiles;
    private final KeyBindings keys;

    private long tick;
    private String serverKey = "unknown";
    private boolean profileLoaded;
    private long lastProfileSaveTick;
    private boolean pendingConfigScreen;

    private double lastSelfX;
    private double lastSelfZ;
    private boolean selfPosSeeded;
    private int lastTargetId = -1;

    public PcpClient(PcpConfig config, KeyBindings keys, File configDirectory) {
        this.config = config;
        this.settings = config.core();
        this.keys = keys;
        this.brain = new CombatBrain(this.settings);
        this.movement = new MovementController(this.settings);
        this.tracker = new TargetTracker(this.settings);
        this.latency = new LatencyMonitor(this.brain.latency());
        this.gate = new AttackGate(this.settings, this.brain, this.hits);
        this.overlay = new DebugOverlay(config);
        this.profiles = new ProfileStore(configDirectory);
    }

    public CombatBrain brain() {
        return this.brain;
    }

    public PcpConfig config() {
        return this.config;
    }

    public SafetyGuard guard() {
        return this.guard;
    }

    public AttackGate gate() {
        return this.gate;
    }

    public MovementController movement() {
        return this.movement;
    }

    public String serverKey() {
        return this.serverKey;
    }

    public void requestConfigScreen() {
        this.pendingConfigScreen = true;
    }

    // ------------------------------------------------------------------
    // Tick pipeline
    // ------------------------------------------------------------------

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) {
            return;
        }
        Minecraft mc = Minecraft.getMinecraft();
        this.tick++;

        if (this.pendingConfigScreen && mc.currentScreen == null) {
            this.pendingConfigScreen = false;
            // Hand inputs back before the screen takes focus, rather than
            // leaving an override in place for the tick it takes the safety
            // guard to notice the screen.
            this.movement.releaseAll("settings screen opening");
            this.gate.flush(mc, this.tick, "settings screen opening");
            mc.displayGuiScreen(new PcpConfigScreen(null, this));
            return;
        }

        handleKeys(mc);

        String block = this.guard.check(mc);
        if (block != null) {
            // Anything we were holding goes back to the player immediately.
            this.movement.releaseAll(block);
            this.gate.tick(mc, this.tick, false);
            this.brain.setSuspended(true, block);
            this.snapshot.reset();
            composeOverlay(mc, block);
            return;
        }
        this.brain.setSuspended(false, "safe");

        EntityPlayerSP me = mc.thePlayer;
        this.movement.install(me);

        if (!this.profileLoaded) {
            loadProfile(mc);
        }

        this.snapshot.reset();
        this.snapshot.tick = this.tick;
        fillSelf(me);
        this.movement.fillSnapshot(this.snapshot);

        this.tracker.update(mc, this.snapshot, this.tick, this.config.targetPlayersOnly);
        if (this.snapshot.targetId != this.lastTargetId) {
            this.lastTargetId = this.snapshot.targetId;
            this.latency.onTargetChanged();
        }

        this.latency.update(mc, this.tracker.target(), this.tracker.lastUpdateGapTicks(), this.snapshot, this.tick);
        this.hits.update(me, this.tracker.target(), this.brain, this.snapshot, this.tick);

        this.brain.update(this.snapshot);

        MovementPlan plan = this.brain.plan();
        MoveAction proposed = plan.action;
        int duration = plan.durationTicks;
        if (this.movement.apply(plan, this.tick)) {
            this.brain.onActionStarted(proposed, duration, this.tick);
        }

        this.gate.tick(mc, this.tick, true);

        if (this.config.persistProfiles && this.tick - this.lastProfileSaveTick > PROFILE_SAVE_INTERVAL_TICKS) {
            this.lastProfileSaveTick = this.tick;
            this.profiles.save(this.brain.knockback(), this.serverKey);
        }

        composeOverlay(mc, null);
    }

    private void fillSelf(EntityPlayerSP me) {
        this.snapshot.selfSprinting = me.isSprinting();
        this.snapshot.selfOnGround = me.onGround;
        this.snapshot.selfHurtTime = me.hurtTime;
        this.snapshot.attackKeyHeld = Minecraft.getMinecraft().gameSettings.keyBindAttack.isKeyDown();

        if (this.selfPosSeeded) {
            double dx = me.posX - this.lastSelfX;
            double dz = me.posZ - this.lastSelfZ;
            this.snapshot.selfSpeed = Math.sqrt(dx * dx + dz * dz);
        }
        this.lastSelfX = me.posX;
        this.lastSelfZ = me.posZ;
        this.selfPosSeeded = true;
    }

    // ------------------------------------------------------------------
    // Input
    // ------------------------------------------------------------------

    @SubscribeEvent
    public void onMouseInput(InputEvent.MouseInputEvent event) {
        handleInput();
    }

    @SubscribeEvent
    public void onKeyInput(InputEvent.KeyInputEvent event) {
        handleInput();
    }

    private void handleInput() {
        Minecraft mc = Minecraft.getMinecraft();
        this.gate.setManualOverrideHeld(KeyBindings.heldSafely(this.keys.manualOverride));
        boolean safe = this.guard.check(mc) == null;
        this.gate.onInputEvent(mc, this.snapshot, this.tick, safe);
    }

    private void handleKeys(Minecraft mc) {
        if (mc.currentScreen != null) {
            return;
        }
        this.guard.setSuspendedByPlayer(KeyBindings.heldSafely(this.keys.suspend));

        if (KeyBindings.bound(this.keys.toggleMaster) && this.keys.toggleMaster.isPressed()) {
            this.settings.masterEnabled = !this.settings.masterEnabled;
            if (!this.settings.masterEnabled) {
                shutDownControls("master toggled off");
            }
            this.config.save();
            feedback("Assist " + onOff(this.settings.masterEnabled));
        }
        if (KeyBindings.bound(this.keys.toggleOverlay) && this.keys.toggleOverlay.isPressed()) {
            this.settings.debugOverlay = !this.settings.debugOverlay;
            this.config.save();
            feedback("Overlay " + onOff(this.settings.debugOverlay));
        }
        if (KeyBindings.bound(this.keys.toggleWTap) && this.keys.toggleWTap.isPressed()) {
            this.settings.wTapEnabled = !this.settings.wTapEnabled;
            this.movement.releaseAll("W-tap toggled");
            this.config.save();
            feedback("W-tap " + onOff(this.settings.wTapEnabled));
        }
        if (KeyBindings.bound(this.keys.toggleSTap) && this.keys.toggleSTap.isPressed()) {
            this.settings.sTapEnabled = !this.settings.sTapEnabled;
            this.movement.releaseAll("S-tap toggled");
            this.config.save();
            feedback("S-tap " + onOff(this.settings.sTapEnabled));
        }
        if (KeyBindings.bound(this.keys.toggleTrade) && this.keys.toggleTrade.isPressed()) {
            this.settings.tradeTimingEnabled = !this.settings.tradeTimingEnabled;
            this.gate.flush(mc, this.tick, "trade assist toggled");
            this.config.save();
            feedback("Trade timing " + onOff(this.settings.tradeTimingEnabled));
        }
        if (KeyBindings.bound(this.keys.openConfig) && this.keys.openConfig.isPressed()) {
            requestConfigScreen();
        }
    }

    /** Releases every controlled input and hands the player full control back. */
    public void shutDownControls(String why) {
        Minecraft mc = Minecraft.getMinecraft();
        this.movement.releaseAll(why);
        this.gate.flush(mc, this.tick, why);
        this.brain.resetFight(why);
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    @SubscribeEvent
    public void onRenderOverlay(RenderGameOverlayEvent.Text event) {
        this.overlay.render(Minecraft.getMinecraft());
    }

    // ------------------------------------------------------------------
    // World / connection lifecycle
    // ------------------------------------------------------------------

    @SubscribeEvent
    public void onWorldUnload(WorldEvent.Unload event) {
        saveProfile();
        resetForNewWorld("world unloaded");
    }

    @SubscribeEvent
    public void onConnect(FMLNetworkEvent.ClientConnectedToServerEvent event) {
        resetForNewWorld("connected");
        this.profileLoaded = false;
    }

    @SubscribeEvent
    public void onDisconnect(FMLNetworkEvent.ClientDisconnectionFromServerEvent event) {
        saveProfile();
        resetForNewWorld("disconnected");
        this.latency.onDisconnect();
        this.profileLoaded = false;
    }

    private void resetForNewWorld(String why) {
        this.movement.releaseAll(why);
        this.gate.discard(why);
        this.brain.resetFight(why);
        this.tracker.clear(why);
        this.hits.reset(why);
        this.selfPosSeeded = false;
        this.lastTargetId = -1;
        this.snapshot.reset();
    }

    // ------------------------------------------------------------------
    // Learned profile
    // ------------------------------------------------------------------

    private void loadProfile(Minecraft mc) {
        this.profileLoaded = true;
        this.serverKey = ProfileStore.serverKey(mc);
        this.brain.knockback().setServerKey(this.serverKey);
        if (this.config.persistProfiles) {
            this.profiles.load(this.brain.knockback(), this.serverKey);
        }
        this.lastProfileSaveTick = this.tick;
    }

    public void saveProfile() {
        if (this.config.persistProfiles && this.profileLoaded) {
            this.profiles.save(this.brain.knockback(), this.serverKey);
        }
    }

    /** Clears the learned profile for this server, on disk as well. */
    public void resetLearnedProfile() {
        this.brain.knockback().reset();
        this.brain.knockback().setServerKey(this.serverKey);
        this.profiles.delete(this.serverKey);
    }

    public ProfileStore profiles() {
        return this.profiles;
    }

    // ------------------------------------------------------------------
    // Overlay composition (once per tick, never per frame)
    // ------------------------------------------------------------------

    private void composeOverlay(Minecraft mc, String blockReason) {
        if (!this.settings.debugOverlay) {
            return;
        }
        this.overlay.begin();

        if (!this.settings.masterEnabled) {
            this.overlay.add("PCP off (master)");
            return;
        }
        if (blockReason != null) {
            this.overlay.add("PCP idle: " + blockReason);
            return;
        }

        LatencyModel lat = this.brain.latency();
        KnockbackProfile kb = this.brain.knockback();
        boolean sprintKind = this.snapshot.lastHitWasSprint;

        this.overlay.add("PCP " + this.brain.state().label() + " " + this.brain.ticksInState(this.tick) + "t"
                + (this.gate.manualOverrideHeld() ? " [manual]" : ""));
        this.overlay.add(" why " + trim(this.brain.stateReason(), 44));

        if (this.snapshot.hasTarget) {
            this.overlay.add(String.format(" gap %.2f %s%.3f/t pred %.2f",
                    this.snapshot.distance,
                    this.snapshot.closingSpeed >= 0.0D ? "closing +" : "opening ",
                    Math.abs(this.snapshot.closingSpeed),
                    this.brain.spacing().predictedDistance(this.snapshot, this.settings.predictionTicks())));
            this.overlay.add(" zone " + this.brain.zone().label() + " | " + trim(this.brain.zoneRationale(), 34));
        } else {
            this.overlay.add(" no opponent tracked");
        }

        this.overlay.add(String.format(" ping %s unc %.1ft resp %s",
                lat.describeOwnLatency(), lat.uncertaintyTicks(),
                lat.hitResponseTicks() < 0.0D ? "n/a" : String.format("%.1ft msr", lat.hitResponseTicks())));
        this.overlay.add(" opp " + trim(lat.describeOpponentLatency(), 44));
        this.overlay.add(" kb  " + kb.describe(sprintKind) + (kb.regimeChangeSeen() ? " !chg" : ""));

        this.overlay.add(" act " + this.movement.activeAction().label()
                + (this.movement.remainingTicks() > 0 ? ("/" + this.movement.remainingTicks() + "t") : "")
                + " | " + trim(this.movement.activeAction() == MoveAction.NONE
                        ? this.brain.plan().reason : this.movement.activeReason(), 34));
        this.overlay.add(" hit " + (this.gate.holding()
                ? ("HOLD " + this.gate.pendingTicks(this.tick) + "t: " + trim(this.gate.pendingReason(), 30))
                : trim(this.gate.lastDecision(), 44)));
    }

    private static String trim(String text, int max) {
        if (text == null) {
            return "-";
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "~";
    }

    private static String onOff(boolean value) {
        return value ? "on" : "off";
    }

    public void feedback(String message) {
        if (!this.config.chatFeedback) {
            return;
        }
        Minecraft mc = Minecraft.getMinecraft();
        if (mc.thePlayer == null) {
            return;
        }
        mc.thePlayer.addChatMessage(new ChatComponentText(
                EnumChatFormatting.AQUA + "[PCP] " + EnumChatFormatting.RESET + message));
    }

    public long currentTick() {
        return this.tick;
    }

    public CombatSnapshot snapshot() {
        return this.snapshot;
    }

    public HitObserver hitObserver() {
        return this.hits;
    }
}
