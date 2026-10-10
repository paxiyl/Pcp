import { PAYMENT_METHODS, PaymentMethod } from "../models/payment-method";
import { UserModel } from "../models/user.model";
import { NotFoundException } from "../utils/app-error";
import { codAvailability } from "./payment.service";

/** The default we fall back to when a customer has never chosen. */
const DEFAULT_METHOD: PaymentMethod = "upi";

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
};

/**
 * What this customer can pay with, and what they prefer.
 *
 * Cash is the only method with a condition attached, and the condition depends
 * on the order — a value ceiling and a cap on open cash orders. With no basket
 * in hand the ceiling is what matters, so availability is computed against a
 * notional zero-value order: that answers "can I use cash at all", which is the
 * question this screen asks. Checkout re-checks against the real total.
 */
export const getPaymentPreferences = async (userId: string): Promise<PaymentPreferences> => {
  const [user, cod] = await Promise.all([
    UserModel.findById(userId).select("preferredPaymentMethod").exec(),
    codAvailability(userId, 0),
  ]);

  if (!user) throw new NotFoundException("Account not found");

  const preferred = user.preferredPaymentMethod ?? DEFAULT_METHOD;

  return {
    cod: { available: cod.available, maxOrderValue: cod.maxOrderValue, reason: cod.reason },
    isExplicit: Boolean(user.preferredPaymentMethod),
    methods: PAYMENT_METHODS.map((method) => ({
      // Everything but cash is handled by the gateway and always offered; cash
      // is ours to settle, so it is ours to refuse.
      available: method === "cod" ? cod.available : true,
      method,
      reason: method === "cod" ? cod.reason : undefined,
    })),
    preferred:
      // Never hand back a preference the customer cannot act on: a saved
      // cash default while cash is switched off would open checkout on a
      // disabled row.
      preferred === "cod" && !cod.available ? DEFAULT_METHOD : preferred,
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
