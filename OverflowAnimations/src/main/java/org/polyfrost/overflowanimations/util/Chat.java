package org.polyfrost.overflowanimations.util;

import net.minecraft.client.Minecraft;
import net.minecraft.event.ClickEvent;
import net.minecraft.event.HoverEvent;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;
import net.minecraft.util.IChatComponent;

import java.util.ArrayList;
import java.util.List;

/**
 * Replaces OneConfig's {@code Notifications}. Messages go to chat, which needs no renderer of
 * its own and so works anywhere the game does — PojavLauncher included. Anything sent before
 * the player exists is held back and flushed once they join.
 */
public class Chat {

    private static final String PREFIX = EnumChatFormatting.GOLD + "[OverflowAnimations] " + EnumChatFormatting.RESET;

    private static final List<IChatComponent> queued = new ArrayList<>();

    private Chat() {
    }

    public static void send(String message) {
        send(new ChatComponentText(PREFIX + message));
    }

    /** Sends {@code message} followed by a clickable link to {@code url}. */
    public static void sendWithLink(String message, String url) {
        ChatComponentText component = new ChatComponentText(PREFIX + message + " ");
        ChatComponentText link = new ChatComponentText(EnumChatFormatting.AQUA + "" + EnumChatFormatting.UNDERLINE + url);
        link.getChatStyle()
                .setChatClickEvent(new ClickEvent(ClickEvent.Action.OPEN_URL, url))
                .setChatHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new ChatComponentText("Click to open")));
        component.appendSibling(link);
        send(component);
    }

    private static void send(IChatComponent component) {
        Minecraft mc = Minecraft.getMinecraft();
        if (mc == null || mc.thePlayer == null) {
            queued.add(component);
            return;
        }
        mc.thePlayer.addChatMessage(component);
    }

    /** Called once per client tick from the mod's event handler. */
    public static void tick() {
        if (queued.isEmpty()) return;
        Minecraft mc = Minecraft.getMinecraft();
        if (mc == null || mc.thePlayer == null) return;
        for (IChatComponent component : queued) {
            mc.thePlayer.addChatMessage(component);
        }
        queued.clear();
    }
}
