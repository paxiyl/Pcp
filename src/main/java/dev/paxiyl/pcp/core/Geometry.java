package dev.paxiyl.pcp.core;

/**
 * The spacing arithmetic, kept free of Minecraft types so it can be tested.
 */
public final class Geometry {

    /**
     * Vertical offset absorbed by aiming within a roughly 1.8-block-tall
     * hitbox before height starts eating into horizontal reach.
     */
    public static final double VERTICAL_FREE_PLAY = 1.0D;

    private Geometry() {
    }

    /**
     * The gap that decides whether a hit can land, in blocks.
     *
     * <p>Vanilla 1.8.9 picks an attack target by casting a 3.0-block ray from
     * the eye against the target's bounding box expanded by its collision
     * border, so the quantity that matters is the horizontal distance to the
     * near face of that box - not centre-to-centre, and not in three
     * dimensions.</p>
     *
     * <p>Using a 3D centre-to-centre distance instead ran 0.45 to 0.65 blocks
     * high in simulation, because it both ignored the hitbox and counted the
     * vertical separation that jumping constantly introduces. Every band
     * derived from the effective range therefore sat that much closer in than
     * configured.</p>
     *
     * @param horizontalCentreDistance horizontal distance between centres
     * @param verticalOffset           absolute difference in feet height
     * @param targetWidth              the target's full hitbox width
     * @param collisionBorder          the target's collision border
     */
    public static double effectiveGap(double horizontalCentreDistance, double verticalOffset,
                                      double targetWidth, double collisionBorder) {
        double excess = Math.max(0.0D, Math.abs(verticalOffset) - VERTICAL_FREE_PLAY);
        double straight = excess <= 0.0D
                ? horizontalCentreDistance
                : Math.sqrt(horizontalCentreDistance * horizontalCentreDistance + excess * excess);
        double surface = targetWidth / 2.0D + collisionBorder;
        return Math.max(0.0D, straight - surface);
    }
}
