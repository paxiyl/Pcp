package com.pcpclip.core.codec;

/** Thrown when no usable encoder backend exists, with a message fit to show the user. */
public class EncoderUnavailableException extends Exception {

    private static final long serialVersionUID = 1L;

    public EncoderUnavailableException(String message) {
        super(message);
    }

    public EncoderUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
