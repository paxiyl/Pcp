package net.minecraftforge.fml.common.gameevent;

/** Compile-only stub; see stubs/java/README.md. */
public class TickEvent {

    public enum Type {
        WORLD, PLAYER, CLIENT, SERVER, RENDER
    }

    public enum Phase {
        START, END
    }

    /** Declared on this class in Forge, which is where the compiler records the field access. */
    public Phase phase;

    public Type type;

    public static class RenderTickEvent extends TickEvent {

        public float renderTickTime;
    }

    public static class ClientTickEvent extends TickEvent {
    }
}
