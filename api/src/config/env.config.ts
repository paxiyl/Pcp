import "dotenv/config";

import { getEnv } from "../utils/get-env";

const envConfig = () => ({
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: Number(getEnv("PORT", "8000")),
  LOG_LEVEL: getEnv("LOG_LEVEL", "info"),
  CORS_ORIGIN: getEnv("CORS_ORIGIN", ""),

  MONGODB_URI: getEnv("MONGODB_URI"),

  // Optional at boot; only upload paths need them.
  CLOUDINARY_CLOUD_NAME: getEnv("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: getEnv("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: getEnv("CLOUDINARY_API_SECRET", ""),

  // Optional at boot; only the payment paths need them.
  STRIPE_SECRET_KEY: getEnv("STRIPE_SECRET_KEY", ""),
  STRIPE_PUBLISHABLE_KEY: getEnv("STRIPE_PUBLISHABLE_KEY", ""),
  STRIPE_WEBHOOK_SECRET: getEnv("STRIPE_WEBHOOK_SECRET", ""),

  // Razorpay is the default gateway for OnlineMall: it is the only one of the
  // two that does UPI, which is how most of Hindaun will pay.
  RAZORPAY_KEY_ID: getEnv("RAZORPAY_KEY_ID", ""),
  RAZORPAY_KEY_SECRET: getEnv("RAZORPAY_KEY_SECRET", ""),
  RAZORPAY_WEBHOOK_SECRET: getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
  /** "razorpay" | "stripe". Stripe stays available for international cards. */
  PAYMENT_PROVIDER: getEnv("PAYMENT_PROVIDER", "razorpay"),

  /**
   * Comma-separated OAuth client ids accepted on a Google ID token. The web app
   * and the Android app are separate clients, so both belong here. Empty turns
   * Google sign-in off, which is the default.
   */
  GOOGLE_CLIENT_IDS: getEnv("GOOGLE_CLIENT_IDS", ""),

  /**
   * Path to the Firebase service account JSON on disk. Empty turns push off,
   * which is the default. A path rather than the JSON itself: a multi-line
   * private key in an env var ends up in logs and process listings.
   */
  FIREBASE_SERVICE_ACCOUNT: getEnv("FIREBASE_SERVICE_ACCOUNT", ""),

  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "7d"),
});

export const Env = envConfig();
