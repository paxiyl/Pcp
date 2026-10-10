import { getFirebaseMessaging } from "../config/firebase.config";
import type { OrderDocument, OrderStatus } from "../models/order.model";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * Order push notifications.
 *
 * Every function here is best-effort and never throws. A notification failing
 * must not fail the thing it was announcing — an order that was placed but
 * reports an error because Google was briefly unreachable is a worse outcome
 * than a missing banner.
 */

type Push = { title: string; body: string; data?: Record<string, string> };

/** Removes tokens FCM tells us are dead, so the list cannot grow forever. */
const dropDeadTokens = async (userId: string, tokens: string[], dead: string[]) => {
  if (dead.length === 0) return;

  await UserModel.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: dead } } }).exec();

  logger.info("Dropped dead push tokens", { count: dead.length, userId });
};

export const sendToUser = async (userId: string, push: Push): Promise<void> => {
  const messaging = getFirebaseMessaging();

  if (!messaging) return;

  try {
    const user = await UserModel.findById(userId).select("pushTokens").exec();
    const tokens = user?.pushTokens ?? [];

    if (tokens.length === 0) return;

    const response = await messaging.sendEachForMulticast({
      // `data` values must be strings; FCM rejects anything else at send time.
      data: push.data,
      notification: { body: push.body, title: push.title },
      tokens,
    });

    // Only drop tokens FCM says are permanently gone. A transient failure must
    // not unsubscribe someone from every future notification.
    const dead = response.responses.flatMap((result, index) => {
      const code = result.error?.code;
      const gone =
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token";

      return gone ? [tokens[index]] : [];
    });

    await dropDeadTokens(userId, tokens, dead);
  } catch (error) {
    logger.error("Push send failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });
  }
};

/**
 * What each status is worth telling someone about.
 *
 * Not every transition earns a notification. "Preparing" matters because it
 * confirms a human saw the order; the intermediate states a customer cannot
 * act on do not, and a phone that buzzes five times per order gets its
 * notifications turned off.
 */
const CUSTOMER_COPY: Partial<Record<OrderStatus, (reference: string) => Push>> = {
  cancelled: (reference) => ({
    body: `Order ${reference} was cancelled. Any payment will be refunded.`,
    title: "Order cancelled",
  }),
  confirmed: (reference) => ({
    body: `Order ${reference} is confirmed and being prepared.`,
    title: "Order confirmed",
  }),
  delivered: (reference) => ({
    body: `Order ${reference} has arrived. Enjoy!`,
    title: "Delivered",
  }),
  out_for_delivery: (reference) => ({
    body: `Your rider is on the way with order ${reference}.`,
    title: "On the way",
  }),
  ready: (reference) => ({
    body: `Order ${reference} is packed and waiting for a rider.`,
    title: "Ready",
  }),
};

/** Call AFTER the order has saved, so nothing is announced that did not persist. */
export const notifyOrderStatus = async (order: OrderDocument): Promise<void> => {
  const build = CUSTOMER_COPY[order.status];

  if (!build) return;

  await sendToUser(order.userId.toString(), {
    ...build(order.reference),
    data: { orderId: order._id.toString(), status: order.status },
  });
};
