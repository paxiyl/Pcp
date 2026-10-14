package com.pcpclip.core.mux;

import java.io.Closeable;
import java.io.File;
import java.io.IOException;

/** Writes encoded frames into a playable container file. */
public interface Muxer extends Closeable {

    File file();

    /** Container name for the UI, e.g. "MP4 (H.264)". */
    String describe();

    /**
     * @param ptsNanos presentation timestamp, relative to the first frame written
     */
    void writeFrame(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
            throws IOException;

    /** Finishes the file: indexes, headers, durations. After this the file is playable. */
    void finish() throws IOException;

    int frameCount();

    /** Closes without finishing; the partial file is removed. */
    @Override
    void close();
}
