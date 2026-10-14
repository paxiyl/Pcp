package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.storage.StorageManager;
import com.pcpclip.core.util.Fmt;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import java.util.List;

/**
 * Where clips go, how much room is left, and recovery for an interrupted session.
 *
 * <p>Android has no reliable way for a JVM inside PojavLauncher to hand a folder to a file
 * manager, so instead of pretending, the screen shows the exact path and copies it to the
 * clipboard - which does work, and is what a player needs to find the clip in their file manager
 * or to type into a share dialog.
 */
public class GuiPcpStorage extends GuiPcpBase {

    private static final int ID_MIN_FREE = 10;
    private static final int ID_MAX_LIBRARY = 40;
    private static final int ID_CLEAR_CACHE = 20;
    private static final int ID_RECOVER = 21;
    private static final int ID_COPY_PATH = 30;
    private static final int ID_CLIPS = 31;

    private String action = "";

    public GuiPcpStorage(GuiScreen parent) {
        super(parent, "PcpClip - Storage");
    }

    @Override
    public void initGui() {
        ClipConfig config = config();
        int y = 62;
        y = addStepper(ID_MIN_FREE, y, "Keep at least " + config.minFreeSpaceMb + " MB free");
        y = addStepper(ID_MAX_LIBRARY, y, config.maxLibraryGb > 0
                ? "Clip folder cap: " + config.maxLibraryGb + " GB (deletes oldest)"
                : "Clip folder cap: off (never deletes)");
        y = addPair(ID_CLEAR_CACHE, ID_RECOVER, y, "Clear buffer cache", "Recover interrupted");
        y = addPair(ID_COPY_PATH, ID_CLIPS, y, "Copy clips path", "Saved clips");
        addDoneButton(y, "Back");

        ClipEngine engine = engine();
        if (engine != null) {
            List<SegmentHandle> orphans = engine.recoverableSegments();
            if (!orphans.isEmpty()) {
                int frames = 0;
                for (SegmentHandle handle : orphans) {
                    frames += handle.frameCount();
                }
                footerLines.add("!An interrupted recording is in the cache: " + orphans.size()
                        + " segments, " + frames + " frames. 'Recover interrupted' saves it.");
            }
            if (!engine.storage().writable()) {
                footerLines.add("!The clips folder is not writable; recording cannot start.");
            }
        }
        if (!action.isEmpty()) {
            footerLines.add("+" + action);
        }
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        super.drawScreen(mouseX, mouseY, partialTicks);
        ClipEngine engine = engine();
        if (engine == null) {
            return;
        }
        StorageManager storage = engine.storage();
        ClipEngine.Status status = engine.status();
        String path = storage.clipDirectory().getAbsolutePath();

        drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(path, width - 10),
                width / 2, 26, LABEL_COLOUR);
        drawCenteredString(fontRendererObj,
                storage.describeFreeSpace() + "   clips " + Fmt.bytes(engine.library().totalBytes())
                        + "   buffer cache " + Fmt.bytes(status.bufferBytes),
                width / 2, 38, storage.lowOnSpace() ? WARN_COLOUR : VALUE_COLOUR);
        drawCenteredString(fontRendererObj,
                "Paths are set in config/pcpclip.cfg", width / 2, 50, LABEL_COLOUR);
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipConfig config = config();
        ClipEngine engine = engine();
        switch (button.id) {
            case ID_MIN_FREE:
                config.minFreeSpaceMb = step(config.minFreeSpaceMb, -128, 64, 20000);
                saveSettings();
                break;
            case ID_MIN_FREE + 1:
                config.minFreeSpaceMb = step(config.minFreeSpaceMb, 128, 64, 20000);
                saveSettings();
                break;
            case ID_MAX_LIBRARY:
                config.maxLibraryGb = step(config.maxLibraryGb, -1, 0, 512);
                saveSettings();
                break;
            case ID_MAX_LIBRARY + 1:
                config.maxLibraryGb = step(config.maxLibraryGb, 1, 0, 512);
                saveSettings();
                break;
            case ID_CLEAR_CACHE:
                if (engine != null) {
                    engine.stopEverything(true);
                    engine.storage().clearCache();
                    action = "Buffer cache cleared.";
                }
                break;
            case ID_RECOVER:
                if (engine != null) {
                    engine.recoverOrphans();
                    action = "Recovering in the background; watch for the confirmation.";
                }
                break;
            case ID_COPY_PATH:
                if (engine != null) {
                    setClipboardString(engine.storage().clipDirectory().getAbsolutePath());
                    action = "Path copied to the clipboard.";
                }
                break;
            case ID_CLIPS:
                mc.displayGuiScreen(new GuiPcpClips(this));
                return;
            default:
                break;
        }
        refresh();
    }
}
