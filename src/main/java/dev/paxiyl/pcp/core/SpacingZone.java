package dev.paxiyl.pcp.core;

/** Distance bands the spacing model sorts the current gap into. */
public enum SpacingZone {

    /** Far enough that attacking is not realistic; closing is safe. */
    OUT_OF_RANGE("far"),
    /** Approaching the edge of our effective range. */
    ENTERING("edge"),
    /** The band where we can hit and still keep a margin: the target band. */
    COMBO_BAND("combo"),
    /** Close enough that both sides land hits; trades happen here. */
    DANGER_CLOSE("danger"),
    /** Pushed apart by knockback; the gap is temporary. */
    KNOCKBACK_GAP("kbgap"),
    /** Advancing now would carry us into an attack that is already coming. */
    WALK_IN_RISK("walkin");

    private final String label;

    SpacingZone(String label) {
        this.label = label;
    }

    public String label() {
        return this.label;
    }
}
