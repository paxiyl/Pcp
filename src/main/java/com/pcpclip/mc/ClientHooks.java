package com.pcpclip.mc;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.util.PcpLog;
import com.pcpclip.mc.capture.CaptureCapabilities;
import com.pcpclip.mc.capture.GlCapture;
import com.pcpclip.mc.ui.GuiPcpMain;
import com.pcpclip.mc.ui.HudOverlay;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.shader.Framebuffer;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;

/**
 * The per-frame and per-tick work, and the only code in the mod that runs on Minecraft's threads.
 *
 * <p>Capture happens at the end of the render tick, which in Forge 1.8.9 is after the world, the
 * HUD and any open screen have all been drawn into the game's framebuffer but before that
 * framebuffer is blitted to the display. That is the one moment where a complete frame exists and
 * can still be read cheaply - and because the indicator is drawn afterwards, it shows on screen
 * without ending up inside clips.
 *
 * <p>When recording is off this handler costs one field read and a branch.
 */
public final class ClientHooks {

    private final ClipEngine engine;
    private final HudOverlay overlay;

    private GlCapture capture;
    private boolean probed;
    private long lastFrameNanos;
    private String contextLabel = "";
    private int consecutiveFailures;

    public ClientHooks(ClipEngine engine, HudOverlay overlay) {
        this.engine = engine;
        this.overlay = overlay;
    }

    @SubscribeEvent
    public void onRenderTick(TickEvent.RenderTickEvent event) {
        if (event.phase != TickEvent.Phase.END) {
            return;
        }
        Minecraft mc = Minecraft.getMinecraft();
        if (mc == null) {
            return;
        }

        long now = System.nanoTime();
        if (lastFrameNanos != 0L) {
            engine.notifyFrameTime(now - lastFrameNanos);
        }
        lastFrameNanos = now;

        if (engine.config().modEnabled) {
            try {
                captureFrame(mc);
            } catch (Throwable error) {
                // A renderer problem must never take the game down with it.
                consecutiveFailures++;
                PcpLog.warn("Capture step failed (" + consecutiveFailures + ")", error);
                if (consecutiveFailures >= 5) {
                    PcpLog.error("Giving up on capture after repeated failures", error);
                    engine.stopEverything(true);
                    overlay.error("Recording stopped: the renderer refused to hand over frames.");
                    consecutiveFailures = 0;
                }
            }
        }

        // Drawn after the capture, so it never appears in a saved clip.
        overlay.render(mc, engine);
    }

    private void captureFrame(Minecraft mc) {
        if (!probed) {
            probed = true;
            capture = new GlCapture(CaptureCapabilities.probe(), engine.config().asyncReadback);
        }

        int sourceWidth;
        int sourceHeight;
        Framebuffer framebuffer = mc.getFramebuffer();
        if (framebuffer != null && framebuffer.framebufferWidth > 0) {
            sourceWidth = framebuffer.framebufferWidth;
            sourceHeight = framebuffer.framebufferHeight;
        } else {
            sourceWidth = mc.displayWidth;
            sourceHeight = mc.displayHeight;
        }
        engine.notifySourceSize(sourceWidth, sourceHeight);

        // Tell the engine which path is live every frame: it owns the flag, so a hotkey or a
        // GUI button starting a recording does not have to guess.
        boolean preScaled = capture.canUseBlitPath();
        engine.notifyCaptureMode(preScaled);
        engine.ensureBuffering(preScaled);

        if (!engine.active() || !engine.wantsCapture()) {
            return;
        }
        VideoFrame frame = engine.acquireFrame();
        if (frame == null) {
            return;                       // every buffer is busy; skipping beats stalling
        }
        OutputGeometry geometry = engine.captureGeometry();
        boolean filled = capture.capture(frame, geometry);
        if (filled) {
            engine.submitFrame(frame, capture.lastCostNanos());
            consecutiveFailures = 0;
        } else {
            frame.release();
        }
    }

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) {
            return;
        }
        Minecraft mc = Minecraft.getMinecraft();
        if (mc == null) {
            return;
        }
        updateContextLabel(mc);
        handleHotkeys(mc);

        GuiScreen requested = PcpClipMod.takeRequestedScreen();
        if (requested != null) {
            mc.displayGuiScreen(requested);
        }
    }

    /** Keeps clip names tied to the world or server the footage came from. */
    private void updateContextLabel(Minecraft mc) {
        String label = "";
        try {
            ServerData server = mc.getCurrentServerData();
            if (server != null && server.serverName != null) {
                label = server.serverName;
            } else if (mc.isSingleplayer() && mc.getIntegratedServer() != null
                    && mc.getIntegratedServer().getWorldName() != null) {
                label = mc.getIntegratedServer().getWorldName();
            }
        } catch (Throwable ignored) {
            // A context label is a nicety; never let it break the tick.
        }
        if (!label.equals(contextLabel)) {
            contextLabel = label;
            engine.setContextLabel(label);
        }
    }

    private void handleHotkeys(Minecraft mc) {
        if (KeyBindings.openMenu != null && KeyBindings.openMenu.isPressed()) {
            mc.displayGuiScreen(new GuiPcpMain(null));
        }
        if (KeyBindings.saveClip != null && KeyBindings.saveClip.isPressed()) {
            engine.saveRollingClip(engine.config().clipSeconds);
        }
        if (KeyBindings.quickSave != null && KeyBindings.quickSave.isPressed()) {
            engine.saveLastAgain();
        }
        if (KeyBindings.toggleRecording != null && KeyBindings.toggleRecording.isPressed()) {
            if (engine.mode() == ClipEngine.Mode.RECORDING
                    || engine.mode() == ClipEngine.Mode.PAUSED) {
                engine.stopRecording();
            } else {
                engine.startRecording();
            }
        }
    }

    /** Renderer details for the status screen, or null before the first frame. */
    public CaptureCapabilities capabilities() {
        return capture == null ? null : capture.capabilities();
    }

    public String capturePath() {
        return capture == null ? "not started" : capture.describePath();
    }
}
