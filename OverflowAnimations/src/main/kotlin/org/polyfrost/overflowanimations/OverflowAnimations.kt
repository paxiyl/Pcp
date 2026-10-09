package org.polyfrost.overflowanimations

import dulkirmod.config.Config
import dulkirmod.config.DulkirConfig
import net.minecraft.client.Minecraft
import net.minecraftforge.client.ClientCommandHandler
import net.minecraftforge.common.MinecraftForge
import net.minecraftforge.fml.common.FMLCommonHandler
import net.minecraftforge.fml.common.Loader
import net.minecraftforge.fml.common.Mod
import net.minecraftforge.fml.common.event.FMLInitializationEvent
import net.minecraftforge.fml.common.event.FMLLoadCompleteEvent
import net.minecraftforge.fml.common.event.FMLPostInitializationEvent
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent
import net.minecraftforge.fml.common.gameevent.TickEvent
import org.polyfrost.overflowanimations.command.OldAnimationsCommand
import org.polyfrost.overflowanimations.config.OldAnimationsSettings
import org.polyfrost.overflowanimations.gui.PleaseMigrateDulkirModGui
import org.polyfrost.overflowanimations.util.Chat
import org.polyfrost.overflowanimations.util.GuiQueue

/**
 * This build deliberately carries no OneConfig. OneConfig's loader pulls in NanoVG and its own
 * LWJGL bindings, which crash on PojavLauncher's GL4ES; the config, the command and the
 * notifications are all handled in-mod instead. Every animation feature, default value and
 * config key is unchanged.
 *
 * A plain Kotlin class (rather than an `object`) is used so Forge's own language adapter can
 * construct it — OneConfig's `KotlinLanguageAdapter` is gone along with the rest of it.
 */
@Mod(
    modid = OverflowAnimations.MODID,
    name = OverflowAnimations.NAME,
    version = OverflowAnimations.VERSION
)
class OverflowAnimations {

    companion object {
        const val MODID: String = "@ID@"
        const val NAME: String = "@NAME@"
        const val VERSION: String = "@VER@"

        @JvmField
        var isPatcherPresent: Boolean = false

        @JvmField
        var doTheFunnyDulkirThing = false

        @JvmField
        var oldDulkirMod: Boolean = false

        @JvmField
        var isDamageTintPresent: Boolean = false

        @JvmField
        var isItemPhysics: Boolean = false

        @JvmField
        var isNEUPresent: Boolean = false

        private var customCrosshair = false
    }

    @Mod.EventHandler
    fun init(event: FMLInitializationEvent) {
        OldAnimationsSettings.INSTANCE.preload()
        ClientCommandHandler.instance.registerCommand(OldAnimationsCommand())
        // On 1.8.9 the two buses are still separate and TickEvent belongs to the FML one.
        FMLCommonHandler.instance().bus().register(this)
        MinecraftForge.EVENT_BUS.register(this)
    }

    @Mod.EventHandler
    fun postInit(event: FMLPostInitializationEvent) {
        if (Loader.isModLoaded("dulkirmod")) {
            doTheFunnyDulkirThing = true
        }
        isPatcherPresent = Loader.isModLoaded("patcher")
        customCrosshair = Loader.isModLoaded("custom-crosshair-mod")
        isDamageTintPresent = Loader.isModLoaded("damagetint")
        isItemPhysics = Loader.isModLoaded("itemphysic")
        isNEUPresent = Loader.isModLoaded("notenoughupdates")
    }

    @Mod.EventHandler
    fun onLoad(event: FMLLoadCompleteEvent) {
        if (customCrosshair) {
            OldAnimationsSettings.smoothModelSneak = false
            OldAnimationsSettings.INSTANCE.save()
            Chat.sendWithLink(
                "Custom Crosshair Mod has been detected, which is written poorly and causes major issues with " +
                    "OverflowAnimations. Disabling Smooth Model Sneak. If you want a better crosshair mod, " +
                    "please use PolyCrosshair instead:",
                "https://modrinth.com/mod/crosshair"
            )
        }
    }

    @SubscribeEvent
    fun onClientTick(event: TickEvent.ClientTickEvent) {
        if (event.phase != TickEvent.Phase.START) return
        GuiQueue.tick()
        Chat.tick()

        val mc = Minecraft.getMinecraft()
        if (mc.currentScreen == null && mc.theWorld != null && mc.thePlayer != null &&
            doTheFunnyDulkirThing && !OldAnimationsSettings.didTheFunnyDulkirThingElectricBoogaloo
        ) {
            try {
                Class.forName("dulkirmod.config.DulkirConfig")
                if (DulkirConfig.INSTANCE.customAnimations) {
                    dulkirTrollage()
                }
            } catch (e: ClassNotFoundException) {
                oldDulkirMod = true
                if (Config.INSTANCE.customAnimations) {
                    dulkirTrollage()
                }
            }
        }
    }

    private fun dulkirTrollage() {
        GuiQueue.open(PleaseMigrateDulkirModGui())
    }
}
