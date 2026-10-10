import type { PaymentProvider } from "../models/order.model";
import { PAYMENT_METHODS, PaymentMethod } from "../models/payment-method";
import { UserModel } from "../models/user.model";
import { NotFoundException } from "../utils/app-error";
import { activeProvider, codAvailability, isProviderConfigured } from "./payment.service";

/** The default we fall back to when a customer has never chosen. */
const DEFAULT_METHOD: PaymentMethod = "upi";

/**
 * Said once, because it is the reason behind four greyed rows.
 *
 * Not "something went wrong": nothing has. The gateway simply has no keys on
 * this deployment yet, and cash does work.
 */
const ONLINE_OFF = "Online payment is not switched on yet — cash on delivery works today";

export type PaymentMethodOption = {
  method: PaymentMethod;
  available: boolean;
  /** Why it cannot be used right now. Shown instead of hiding the row. */
  reason?: string;
};

export type PaymentPreferences = {
  preferred: PaymentMethod;
  /** True once the customer has actually chosen, rather than inherited UPI. */
  isExplicit: boolean;
  methods: PaymentMethodOption[];
  cod: { maxOrderValue: number; available: boolean; reason?: string };
  /**
   * Which gateway would take a card or UPI payment, and whether it is set up.
   *
   * The app needs the provider as well as the answer: a method the server can
   * take is still unusable if this build cannot open that provider's sheet.
   */
  online: { available: boolean; provider: PaymentProvider };
};

/**
 * What this customer can pay with, and what they prefer.
 *
 * Cash has a condition that depends on the order — a value ceiling and a cap on
 * open cash orders. With no basket in hand the ceiling is what matters, so
 * availability is computed against a notional zero-value order: that answers
 * "can I use cash at all", which is the question this screen asks. Checkout
 * re-checks against the real total.
 *
 * Everything else depends on the gateway being configured. This used to read
 * `available: true` for all four, with a comment saying the gateway handles
 * them — which is true only once it has keys. Without them a customer chose UPI
 * here, filled the whole of checkout, and was refused at the Pay button.
 */
export const getPaymentPreferences = async (userId: string): Promise<PaymentPreferences> => {
  const [user, cod] = await Promise.all([
    UserModel.findById(userId).select("preferredPaymentMethod").exec(),
    codAvailability(userId, 0),
  ]);

  if (!user) throw new NotFoundException("Account not found");

  const preferred = user.preferredPaymentMethod ?? DEFAULT_METHOD;
  const provider = activeProvider();
  const online = isProviderConfigured(provider);

  const isAvailable = (method: PaymentMethod) => (method === "cod" ? cod.available : online);

  return {
    cod: { available: cod.available, maxOrderValue: cod.maxOrderValue, reason: cod.reason },
    isExplicit: Boolean(user.preferredPaymentMethod),
    methods: PAYMENT_METHODS.map((method) => ({
      available: isAvailable(method),
      method,
      reason: method === "cod" ? cod.reason : online ? undefined : ONLINE_OFF,
    })),
    online: { available: online, provider },
    /*
      An explicit choice comes back exactly as it was made, even when it cannot
      be used today: the row carries the reason, and checkout opens on whatever
      does work rather than on this (`openingMethod`, in the app, checked by
      payment-availability.check.mjs). Substituting here would silently forget
      what the customer asked for the moment a gateway went down, and they would
      have to choose again when it came back.

      A customer who has never chosen gets a method that works, which is the one
      case where there is nothing to lose by picking for them.
    */
    preferred: user.preferredPaymentMethod ?? (online ? DEFAULT_METHOD : "cod"),
  };
};

export const setPreferredPaymentMethod = async (
  userId: string,
  method: PaymentMethod,
): Promise<PaymentPreferences> => {
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { preferredPaymentMethod: method } },
    { returnDocument: "after" },
  ).exec();

  if (!updated) throw new NotFoundException("Account not found");

  return getPaymentPreferences(userId);
};
