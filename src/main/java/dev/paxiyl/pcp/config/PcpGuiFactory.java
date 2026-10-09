package dev.paxiyl.pcp.config;

import java.util.Set;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiScreen;
import net.minecraftforge.fml.client.IModGuiFactory;

/**
 * Hooks {@link PcpConfigScreen} up to the Config button on the Forge mod list.
 */
public class PcpGuiFactory implements IModGuiFactory {

    @Override
    public void initialize(Minecraft minecraftInstance) {
        // Nothing to prepare: the screen reads live settings when it opens.
    }

    @Override
    public Class<? extends GuiScreen> mainConfigGuiClass() {
        return PcpConfigScreen.class;
    }

    @Override
    public Set<RuntimeOptionCategoryElement> runtimeGuiCategories() {
        return null;
    }

    @Override
    public RuntimeOptionGuiHandler getHandlerFor(RuntimeOptionCategoryElement element) {
        return null;
    }
}
