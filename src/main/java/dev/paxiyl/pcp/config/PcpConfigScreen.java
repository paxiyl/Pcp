package dev.paxiyl.pcp.config;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import dev.paxiyl.pcp.PcpMod;
import dev.paxiyl.pcp.client.PcpClient;
import dev.paxiyl.pcp.core.CoreSettings;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

/**
 * In-game settings screen.
 *
 * <p>Laid out as rows of {@code [-] [name: value] [+]} with large hit areas,
 * because the likeliest place this gets used is a touch screen under
 * PojavLauncher. Every row maps to one setting and goes through the clamping
 * setters on {@link CoreSettings}, so nothing here can produce an out-of-range
 * configuration. Closing the screen saves.</p>
 */
public class PcpConfigScreen extends GuiScreen {

    private static final int ROWS_PER_PAGE = 6;
    private static final int ROW_HEIGHT = 22;
    private static final int PANEL_WIDTH = 300;

    private static final int ID_PREV = 1;
    private static final int ID_NEXT = 2;
    private static final int ID_RESET = 3;
    private static final int ID_DONE = 4;
    private static final int ID_ROW_BASE = 100;

    private final GuiScreen parent;
    private final PcpClient client;
    private final PcpConfig config;
    private final CoreSettings settings;
    private final List<Entry> entries = new ArrayList<Entry>();

    private int page;
    private boolean resetArmed;

    /** Constructor Forge's mod list uses for the Config button. */
    public PcpConfigScreen(GuiScreen parent) {
        this(parent, PcpMod.client());
    }

    public PcpConfigScreen(GuiScreen parent, PcpClient client) {
        this.parent = parent;
        this.client = client;
        this.config = client == null ? null : client.config();
        this.settings = this.config == null ? new CoreSettings() : this.config.core();
        buildEntries();
    }

    // ------------------------------------------------------------------
    // Entries
    // ------------------------------------------------------------------

    private abstract static class Entry {
        final String label;

        Entry(String label) {
            this.label = label;
        }

        abstract String value();

        abstract void adjust(int direction);
    }

    private abstract class Toggle extends Entry {
        Toggle(String label) {
            super(label);
        }

        abstract boolean get();

        abstract void set(boolean value);

        @Override
        String value() {
            return get() ? "on" : "off";
        }

        @Override
        void adjust(int direction) {
            set(!get());
        }
    }

    private void buildEntries() {
        final CoreSettings s = this.settings;
        final PcpConfig c = this.config;

        this.entries.add(new Toggle("Master enable") {
            boolean get() {
                return s.masterEnabled;
            }

            void set(boolean v) {
                s.masterEnabled = v;
                if (!v && PcpConfigScreen.this.client != null) {
                    PcpConfigScreen.this.client.shutDownControls("disabled in config screen");
                }
            }
        });
        this.entries.add(new Toggle("W-tap assist") {
            boolean get() {
                return s.wTapEnabled;
            }

            void set(boolean v) {
                s.wTapEnabled = v;
            }
        });
        this.entries.add(new Toggle("S-tap assist") {
            boolean get() {
                return s.sTapEnabled;
            }

            void set(boolean v) {
                s.sTapEnabled = v;
            }
        });
        this.entries.add(new Toggle("Trade-timing assist") {
            boolean get() {
                return s.tradeTimingEnabled;
            }

            void set(boolean v) {
                s.tradeTimingEnabled = v;
            }
        });
        this.entries.add(new Toggle("Spacing assist") {
            boolean get() {
                return s.spacingEnabled;
            }

            void set(boolean v) {
                s.spacingEnabled = v;
            }
        });
        this.entries.add(new Toggle("Debug overlay") {
            boolean get() {
                return s.debugOverlay;
            }

            void set(boolean v) {
                s.debugOverlay = v;
            }
        });

        this.entries.add(new Entry("Min tap length") {
            String value() {
                return s.minTapTicks() + "t";
            }

            void adjust(int d) {
                s.setMinTapTicks(s.minTapTicks() + d);
            }
        });
        this.entries.add(new Entry("Max tap length") {
            String value() {
                return s.maxTapTicks() + "t";
            }

            void adjust(int d) {
                s.setMaxTapTicks(s.maxTapTicks() + d);
            }
        });
        this.entries.add(new Entry("Action cooldown") {
            String value() {
                return s.actionCooldownTicks() + "t";
            }

            void adjust(int d) {
                s.setActionCooldownTicks(s.actionCooldownTicks() + d);
            }
        });
        this.entries.add(new Entry("Direction flip guard") {
            String value() {
                return s.directionFlipGuardTicks() + "t";
            }

            void adjust(int d) {
                s.setDirectionFlipGuardTicks(s.directionFlipGuardTicks() + d);
            }
        });
        this.entries.add(new Entry("Max attack hold") {
            String value() {
                return s.maxTradeDelayTicks() + "t";
            }

            void adjust(int d) {
                s.setMaxTradeDelayTicks(s.maxTradeDelayTicks() + d);
            }
        });
        this.entries.add(new Entry("Effective range est.") {
            String value() {
                return String.format("%.2f blocks", s.effectiveRange());
            }

            void adjust(int d) {
                s.setEffectiveRange(s.effectiveRange() + d * 0.05D);
            }
        });

        this.entries.add(new Entry("Combo band fraction") {
            String value() {
                return String.format("%.2f (%.2f blocks)", s.comboBandFraction(), s.comboBandDistance());
            }

            void adjust(int d) {
                s.setComboBandFraction(s.comboBandFraction() + d * 0.01D);
            }
        });
        this.entries.add(new Entry("Danger-close fraction") {
            String value() {
                return String.format("%.2f (%.2f blocks)", s.dangerCloseFraction(), s.dangerCloseDistance());
            }

            void adjust(int d) {
                s.setDangerCloseFraction(s.dangerCloseFraction() + d * 0.01D);
            }
        });
        this.entries.add(new Entry("Prediction window") {
            String value() {
                return s.predictionTicks() + "t";
            }

            void adjust(int d) {
                s.setPredictionTicks(s.predictionTicks() + d);
            }
        });
        this.entries.add(new Entry("Max target distance") {
            String value() {
                return String.format("%.1f blocks", s.maxTargetDistance());
            }

            void adjust(int d) {
                s.setMaxTargetDistance(s.maxTargetDistance() + d * 0.5D);
            }
        });
        this.entries.add(new Entry("Learning aggressiveness") {
            String value() {
                return String.format("%.2f", s.learningRate());
            }

            void adjust(int d) {
                s.setLearningRate(s.learningRate() + d * 0.05D);
            }
        });
        this.entries.add(new Entry("Min confidence") {
            String value() {
                return String.format("%.0f%%", s.minConfidence() * 100.0D);
            }

            void adjust(int d) {
                s.setMinConfidence(s.minConfidence() + d * 0.05D);
            }
        });

        this.entries.add(new Entry("Target timeout") {
            String value() {
                return s.targetTimeoutTicks() + "t";
            }

            void adjust(int d) {
                s.setTargetTimeoutTicks(s.targetTimeoutTicks() + d * 5);
            }
        });
        this.entries.add(new Entry("State stuck guard") {
            String value() {
                return s.stateStuckTicks() + "t";
            }

            void adjust(int d) {
                s.setStateStuckTicks(s.stateStuckTicks() + d * 10);
            }
        });
        if (c != null) {
            this.entries.add(new Entry("Overlay corner") {
                String value() {
                    switch (c.overlayCorner) {
                        case 1:
                            return "top-right";
                        case 2:
                            return "bottom-left";
                        case 3:
                            return "bottom-right";
                        default:
                            return "top-left";
                    }
                }

                void adjust(int d) {
                    c.overlayCorner = (c.overlayCorner + d + 4) % 4;
                }
            });
            this.entries.add(new Entry("Overlay margin") {
                String value() {
                    return c.overlayMargin + "px";
                }

                void adjust(int d) {
                    c.overlayMargin = Math.max(0, Math.min(80, c.overlayMargin + d));
                }
            });
            this.entries.add(new Toggle("Players only as targets") {
                boolean get() {
                    return c.targetPlayersOnly;
                }

                void set(boolean v) {
                    c.targetPlayersOnly = v;
                }
            });
            this.entries.add(new Toggle("Persist learned profile") {
                boolean get() {
                    return c.persistProfiles;
                }

                void set(boolean v) {
                    c.persistProfiles = v;
                }
            });
            this.entries.add(new Toggle("Chat feedback") {
                boolean get() {
                    return c.chatFeedback;
                }

                void set(boolean v) {
                    c.chatFeedback = v;
                }
            });
        }
    }

    private int pageCount() {
        return Math.max(1, (this.entries.size() + ROWS_PER_PAGE - 1) / ROWS_PER_PAGE);
    }

    // ------------------------------------------------------------------
    // Screen
    // ------------------------------------------------------------------

    @Override
    public void initGui() {
        this.buttonList.clear();
        int left = this.width / 2 - PANEL_WIDTH / 2;
        int top = 40;

        int first = this.page * ROWS_PER_PAGE;
        for (int row = 0; row < ROWS_PER_PAGE; row++) {
            int index = first + row;
            if (index >= this.entries.size()) {
                break;
            }
            int y = top + row * ROW_HEIGHT;
            int id = ID_ROW_BASE + row * 3;
            this.buttonList.add(new GuiButton(id, left, y, 24, 20, "-"));
            this.buttonList.add(new GuiButton(id + 1, left + 27, y, PANEL_WIDTH - 54, 20, rowText(this.entries.get(index))));
            this.buttonList.add(new GuiButton(id + 2, left + PANEL_WIDTH - 24, y, 24, 20, "+"));
        }

        int bottom = top + ROWS_PER_PAGE * ROW_HEIGHT + 10;
        this.buttonList.add(new GuiButton(ID_PREV, left, bottom, 70, 20, "< Page"));
        this.buttonList.add(new GuiButton(ID_NEXT, left + 74, bottom, 70, 20, "Page >"));
        this.buttonList.add(new GuiButton(ID_RESET, left + 148, bottom, 152, 20, resetLabel()));
        this.buttonList.add(new GuiButton(ID_DONE, left + PANEL_WIDTH / 2 - 50, bottom + 24, 100, 20, "Done"));
    }

    private String resetLabel() {
        return this.resetArmed ? "Confirm profile reset?" : "Reset learned profile";
    }

    private String rowText(Entry entry) {
        return entry.label + ": " + entry.value();
    }

    @Override
    protected void actionPerformed(GuiButton button) throws IOException {
        if (button.id == ID_DONE) {
            this.mc.displayGuiScreen(this.parent);
            return;
        }
        if (button.id == ID_PREV) {
            this.page = (this.page - 1 + pageCount()) % pageCount();
            this.resetArmed = false;
            initGui();
            return;
        }
        if (button.id == ID_NEXT) {
            this.page = (this.page + 1) % pageCount();
            this.resetArmed = false;
            initGui();
            return;
        }
        if (button.id == ID_RESET) {
            if (!this.resetArmed) {
                this.resetArmed = true;
            } else {
                this.resetArmed = false;
                if (this.client != null) {
                    this.client.resetLearnedProfile();
                    this.client.feedback("Learned knockback profile cleared.");
                }
            }
            initGui();
            return;
        }
        if (button.id >= ID_ROW_BASE) {
            int offset = button.id - ID_ROW_BASE;
            int row = offset / 3;
            int kind = offset % 3;
            int index = this.page * ROWS_PER_PAGE + row;
            if (index < 0 || index >= this.entries.size()) {
                return;
            }
            Entry entry = this.entries.get(index);
            // Left button decreases, right increases, the wide middle button
            // advances - which also makes every row usable with one tap.
            entry.adjust(kind == 0 ? -1 : 1);
            if (this.config != null) {
                this.config.save();
            }
            initGui();
        }
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawDefaultBackground();
        String title = "PCP - Adaptive Spacing (page " + (this.page + 1) + "/" + pageCount() + ")";
        drawCenteredString(this.fontRendererObj, title, this.width / 2, 14, 0xFFFFFF);
        super.drawScreen(mouseX, mouseY, partialTicks);
        String hint = "Durations are in ticks (1t = 50ms). Learned values are estimates, not server settings.";
        drawCenteredString(this.fontRendererObj, hint, this.width / 2, this.height - 22, 0xA0A0A0);
    }

    @Override
    public void onGuiClosed() {
        if (this.config != null) {
            this.config.save();
        }
    }

    @Override
    public boolean doesGuiPauseGame() {
        return false;
    }
}
