package dev.paxiyl.pcp.core;

/**
 * Small ring buffer of recent decisions, so the overlay can show why the last
 * action happened instead of only what happened.
 */
public final class DecisionLog {

    private final String[] entries;
    private final long[] ticks;
    private int head;
    private int size;

    public DecisionLog(int capacity) {
        if (capacity < 1) {
            capacity = 1;
        }
        this.entries = new String[capacity];
        this.ticks = new long[capacity];
    }

    public void add(long tick, String entry) {
        if (entry == null) {
            return;
        }
        // Collapse repeats so a per-tick condition does not flood the log.
        if (this.size > 0 && entry.equals(this.entries[(this.head - 1 + this.entries.length) % this.entries.length])) {
            return;
        }
        this.entries[this.head] = entry;
        this.ticks[this.head] = tick;
        this.head = (this.head + 1) % this.entries.length;
        if (this.size < this.entries.length) {
            this.size++;
        }
    }

    /** @param back 0 is the newest entry. */
    public String get(int back) {
        if (back < 0 || back >= this.size) {
            return null;
        }
        return this.entries[(this.head - 1 - back + this.entries.length * 2) % this.entries.length];
    }

    public long tickOf(int back) {
        if (back < 0 || back >= this.size) {
            return -1L;
        }
        return this.ticks[(this.head - 1 - back + this.entries.length * 2) % this.entries.length];
    }

    public String newest() {
        return this.size == 0 ? "-" : get(0);
    }

    public int size() {
        return this.size;
    }

    public void clear() {
        this.head = 0;
        this.size = 0;
    }
}
