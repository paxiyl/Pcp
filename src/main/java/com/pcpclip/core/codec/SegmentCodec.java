package com.pcpclip.core.codec;

/** Codecs the pipeline can store in a buffer segment, and the container each one belongs in. */
public enum SegmentCodec {

    /** Baseline H.264 in Annex-B form; every segment starts with its own SPS, PPS and IDR. */
    H264(1, "h264", "mp4"),

    /** One baseline JPEG per frame. */
    MJPEG(2, "mjpeg", "avi");

    private final int id;
    private final String codecName;
    private final String containerExtension;

    SegmentCodec(int id, String codecName, String containerExtension) {
        this.id = id;
        this.codecName = codecName;
        this.containerExtension = containerExtension;
    }

    public int id() {
        return id;
    }

    public String codecName() {
        return codecName;
    }

    public String containerExtension() {
        return containerExtension;
    }

    /** Every frame of a Motion JPEG stream stands alone, which makes trimming exact. */
    public boolean everyFrameIsKeyframe() {
        return this == MJPEG;
    }

    public static SegmentCodec byId(int id) {
        for (SegmentCodec codec : values()) {
            if (codec.id == id) {
                return codec;
            }
        }
        return null;
    }
}
