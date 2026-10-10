import { readFileSync } from "node:fs";

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

import { logger } from "../utils/logger";
import { Env } from "./env.config";

/**
 * Firebase Cloud Messaging, for order push notifications.
 *
 * Deliberately NOT Expo's push service: that needs an EAS project id, and this
 * API is self-hosted, so going straight to FCM removes a hop and a dependency
 * on someone else's uptime for something as time-critical as "your rider is
 * outside".
 *
 * The service account key is read from a FILE on disk, never from an
 * environment variable holding the JSON itself. A multi-line private key in an
 * env var is how it ends up in a log line or a process listing.
 */

let app: App | null = null;
let messaging: Messaging | null = null;
let failed = false;

/** Whether the server can send push at all. */
export const isPushConfigured = (): boolean => Boolean(Env.FIREBASE_SERVICE_ACCOUNT) && !failed;

export const getFirebaseMessaging = (): Messaging | null => {
  if (!Env.FIREBASE_SERVICE_ACCOUNT || failed) return null;
  if (messaging) return messaging;

  try {
    const raw = readFileSync(Env.FIREBASE_SERVICE_ACCOUNT, "utf8");
    const credentials = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    // Mapped rather than passed through: the JSON is snake_case and the SDK
    // wants camelCase, and a silent mismatch here fails at send time.
    app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
          projectId: credentials.project_id,
        }),
      });
    messaging = getMessaging(app);

    logger.info("Push messaging ready", { project: credentials.project_id });

    return messaging;
  } catch (error) {
    // A missing or malformed key must not take the API down. Orders still work
    // without notifications; the reverse is not true.
    failed = true;
    logger.error("Push messaging unavailable", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
};
