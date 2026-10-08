import mongoose, { Types } from "mongoose";



import { BasketDocument, BasketModel, VendorKind } from "../models/basket.model";
import { OrderDocument, OrderModel, OrderStatus, PaymentMethod } from "../models/order.model";
import { ProductModel } from "../models/product.model";
import { RestaurantModel } from "../models/restaurant.model";
import { StoreModel } from "../models/store.model";
import { UserAddressDocument, UserAddressModel } from "../models/user-address.model";
import { UserDocument, UserModel } from "../models/user.model";
import { VendorFees } from "../types/basket.types";
import { CheckoutPayload, ReorderResult } from "../types/order.types";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { logger } from "../utils/logger";
import { CreateOrderInput, VerifyPaymentInput } from "../validators/order.validator";
import {
  addItem,
  addProduct,
  clearBasket,
  computeTotals,
  findAvailableDish,
  optionIdsFromNames,
  priceSelection,
} from "./basket.service";
import {
  CURRENCY,
  fetchPaymentVerdict,
  isProviderConfigured,
  codAvailability,
  openCheckoutSession,
  providerFor,
  verifyRazorpayCallback,
} from "./payment.service";
import { commissionRateFor, getServiceFeeRate } from "./settings.service";


/** Four digits the customer reads out to the rider at the door. */
const newDeliveryCode = () => String(Math.floor(1000 + Math.random() * 9000));

/** GeoJSON is [longitude, latitude]; flip it once, here. */
const toPoint = (location?: { coordinates?: number[] }) =>
  location?.coordinates && location.coordinates.length === 2
    ? { lat: location.coordinates[1], lng: location.coordinates[0] }
    : undefined;

/** Short, human-quotable reference. Collisions are retried, never ignored. */
const nextReference = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = `CH-${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await OrderModel.exists({ reference }).exec();

    if (!taken) return reference;
  }

  throw new Error("Could not allocate an order reference");
};

/** Every status change is appended, so the order carries its own tracking log. */
export const pushStatus = (order: OrderDocument, status: OrderStatus, note?: string) => {
  order.status = status;
  order.statusHistory.push({ at: new Date(), note, status } as never);
};

const resolveAddress = async (
  userId: string,
  addressId?: string,
): Promise<UserAddressDocument> => {
  const address = addressId
    ? await UserAddressModel.findOne({ _id: addressId, userId }).exec()
    : await UserAddressModel.findOne({ userId, isDefault: true }).exec();

  if (!address) {
    throw new BadRequestException("Add a delivery address before placing an order");
  }

  return address;
};

/**
 * Cash on delivery is a credit decision, not a payment one. Two limits, both
 * admin-controlled: how much cash a rider may be asked to carry, and how many
 * unsettled COD orders one customer may have open at once.
 */
const assertCodAllowed = async (userId: string, total: number): Promise<void> => {
  const { available, reason } = await codAvailability(userId, total);

  if (!available) {
    throw new BadRequestException(
      reason ? `${reason}. Please pay online for this order.` : "Cash on delivery is not available",
    );
  }
};

/**
 * Moves stock off the shelf, once, when an order becomes real.
 *
 * Deliberately NOT done at checkout-open: reserving against an unpaid order
 * leaks inventory on every abandoned payment sheet, and this is a shop with
 * single-digit stock counts where that is immediately visible.
 *
 * The decrement is guarded by `stock: { $gte: quantity }` so two orders racing
 * for the last pack cannot both win. A line that loses the race is logged rather
 * than thrown: the customer has already paid, so the order stands and the shop
 * resolves the shortfall — refusing it here would take money for nothing.
 */
const commitStock = async (order: OrderDocument): Promise<void> => {
  for (const item of order.items) {
    if (!item.productId) continue;

    const result = await ProductModel.updateOne(
      { _id: item.productId, stock: mongoose.trusted({ $gte: item.quantity }) },
      { $inc: { stock: -item.quantity } },
    ).exec();

    if (result.modifiedCount === 0) {
      logger.warn("Order committed beyond available stock", {
        name: item.name,
        orderId: order._id.toString(),
        productId: item.productId.toString(),
        quantity: item.quantity,
      });
    }
  }
};

/**
 * Everything order creation needs from a vendor, flattened so the builder below
 * does not branch on which collection it came from.
 *
 * A store has no prep-time RANGE — quick commerce promises one number — so its
 * single ETA is reported as both ends of the range. That keeps the order model
 * and every screen reading `prepTimeMin/Max` working unchanged.
 */
type OrderVendor = {
  kind: VendorKind;
  id: Types.ObjectId;
  name: string;
  imageUrl: string;
  address: string;
  location?: { coordinates?: number[] };
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  commissionRate?: number;
  fees: VendorFees;
};

const resolveOrderVendor = async (basket: BasketDocument): Promise<OrderVendor> => {
  if (basket.vendorKind === "store") {
    const store = await StoreModel.findOne({ _id: basket.storeId, isActive: true }).exec();

    if (!store) throw new NotFoundException("Store not found");

    return {
      address: store.address,
      commissionRate: store.commissionRate,
      fees: {
        deliveryFee: store.deliveryFee,
        freeDeliveryThreshold: store.freeDeliveryThreshold ?? null,
        minOrder: store.minOrder,
      },
      id: store._id,
      imageUrl: store.imageUrl,
      kind: "store",
      location: store.location,
      name: store.name,
      prepTimeMaxMinutes: store.etaMinutes,
      prepTimeMinMinutes: store.etaMinutes,
    };
  }

  const restaurant = await RestaurantModel.findOne({
    _id: basket.restaurantId,
    isActive: true,
  }).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  return {
    address: restaurant.address,
    commissionRate: restaurant.commissionRate,
    fees: {
      deliveryFee: restaurant.deliveryFee,
      freeDeliveryThreshold: restaurant.freeDeliveryThreshold ?? null,
      minOrder: restaurant.minOrder,
    },
    id: restaurant._id,
    imageUrl: restaurant.imageUrl,
    kind: "restaurant",
    location: restaurant.location,
    name: restaurant.name,
    prepTimeMaxMinutes: restaurant.prepTimeMaxMinutes,
    prepTimeMinMinutes: restaurant.prepTimeMinMinutes,
  };
};

/**
 * Builds the order from the stored basket and opens a payment for it. The
 * amount charged is recomputed here; nothing about price comes from the client.
 */
export const createOrder = async (
  user: UserDocument,
  input: CreateOrderInput,
): Promise<CheckoutPayload> => {
  const method = input.paymentMethod;
  const provider = providerFor(method);

  if (!isProviderConfigured(provider)) {
    throw new BadRequestException("Payments are not available right now");
  }

  const userId = user._id.toString();
  const basket = await BasketModel.findOne({ userId }).exec();

  if (!basket || basket.items.length === 0) {
    throw new BadRequestException("Your basket is empty");
  }

  // One resolution step for both catalogues: whichever vendor owns the basket is
  // flattened to the same snapshot and fee terms, so everything below this point
  // is written once rather than branched.
  const vendor = await resolveOrderVendor(basket);

  const totals = computeTotals(basket, vendor.fees, await getServiceFeeRate());

  if (totals.belowMinimum) {
    throw new BadRequestException(
      `Your basket is below ${vendor.name}'s minimum order`,
    );
  }

  const address = await resolveAddress(userId, input.addressId);
  const reference = await nextReference();

  // The platform's cut, fixed at the moment of ordering.
  const commissionRate = await commissionRateFor(vendor.commissionRate);
  const commission = Math.round(totals.subtotal * commissionRate);

  const order = new OrderModel({
    commission,
    commissionRate,
    contactName: user.name,
    contactPhone: input.contactPhone ?? user.phone,
    currency: CURRENCY,
    deliveryAddress: {
      city: address.city,
      instructions: input.deliveryInstructions ?? address.instructions,
      line1: address.line1,
      line2: address.line2,
      postcode: address.postcode,
    },
    deliveryCode: newDeliveryCode(),
    deliveryFee: totals.deliveryFee,
    deliveryLocation: toPoint(address.location),
    estimatedDeliveryAt: new Date(Date.now() + vendor.prepTimeMaxMinutes * 60_000),
    includeCutlery: basket.includeCutlery,
    items: basket.items.map((item) => ({
      dishId: item.dishId,
      productId: item.productId,
      imageUrl: item.imageUrl,
      name: item.name,
      note: item.note,
      optionIds: item.optionIds,
      optionNames: item.optionNames,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    orderNote: basket.orderNote,
    prepTimeMaxMinutes: vendor.prepTimeMaxMinutes,
    prepTimeMinMinutes: vendor.prepTimeMinMinutes,
    reference,
    restaurantId: vendor.kind === "restaurant" ? vendor.id : undefined,
    storeId: vendor.kind === "store" ? vendor.id : undefined,
    vendorKind: vendor.kind,
    restaurantAddress: vendor.address,
    restaurantImageUrl: vendor.imageUrl,
    restaurantLocation: toPoint(vendor.location),
    restaurantName: vendor.name,
    restaurantPayout: totals.subtotal - commission,
    serviceFee: totals.serviceFee,
    subtotal: totals.subtotal,
    paymentMethod: method,
    paymentProvider: provider,
    total: totals.total,
    userId: user._id,
  });

  // Cash on delivery is not a gateway payment. There is nothing to open and
  // nothing to confirm later, so the order is placed outright and the money is
  // owed at the door instead.
  if (method === "cod") {
    await assertCodAllowed(userId, totals.total);

    order.codAmountDue = totals.total;
    pushStatus(order, "confirmed", "Order placed \u2014 pay cash on delivery");
    await order.save();

    await commitStock(order);
    await clearBasket(userId);

    return { checkout: null, order };
  }

  pushStatus(order, "pending_payment", "Waiting for payment");
  await order.save();

  let checkout;

  try {
    checkout = await openCheckoutSession(order, user);
  } catch (error) {
    // An order that can never be paid should not sit in the customer's list.
    await order.deleteOne();

    throw error;
  }

  order.providerOrderId = checkout.providerOrderId;
  // Stripe's PaymentIntent id is both the session and the payment; Razorpay's
  // payment id does not exist until the customer actually pays.
  if (provider === "stripe") order.paymentIntentId = checkout.providerOrderId;
  await order.save();

  return { checkout, order };
};

/**
 * Rebuilds the basket from a past order. Items are re-priced from the CURRENT
 * dish or product, never from the old order, and anything that has since changed
 * or gone away is reported instead of being quietly dropped.
 *
 * A store reorder has a failure mode a restaurant reorder does not: the product
 * still exists but the shop no longer has enough of it. That is reported as a
 * skip with the rest, so the customer is told once rather than hitting it later
 * at the stepper.
 */
export const reorder = async (userId: string, orderId: string): Promise<ReorderResult> => {
  const order = await findOrder(userId, orderId);

  // Rehearse the whole order first. Clearing the basket before knowing whether
  // anything can be re-added would throw away a basket the customer was filling.
  const dishAdditions: {
    dishId: string;
    note?: string;
    optionIds: string[];
    quantity: number;
  }[] = [];
  const productAdditions: { productId: string; quantity: number }[] = [];
  const skipped: string[] = [];

  for (const item of order.items) {
    if (item.productId) {
      const product = await ProductModel.findOne({
        _id: item.productId,
        isAvailable: true,
      }).exec();

      if (!product || product.stock <= 0) {
        skipped.push(item.name);
        continue;
      }

      // Re-add what the shelf can actually cover rather than failing the whole
      // line: four of the six is more use than none of them.
      const quantity = Math.min(item.quantity, product.stock, product.maxPerOrder);

      if (quantity < item.quantity) skipped.push(item.name);

      productAdditions.push({ productId: product._id.toString(), quantity });
      continue;
    }

    if (!item.dishId) {
      skipped.push(item.name);
      continue;
    }

    const dish = await findAvailableDish(item.dishId.toString());

    if (!dish) {
      skipped.push(item.name);
      continue;
    }

    // Orders placed before option ids were stored only carry names.
    const optionIds = item.optionIds.length
      ? item.optionIds.map(String)
      : optionIdsFromNames(dish, item.optionNames);

    try {
      priceSelection(dish, optionIds);
    } catch {
      skipped.push(item.name);
      continue;
    }

    dishAdditions.push({
      dishId: dish._id.toString(),
      note: item.note,
      optionIds,
      quantity: item.quantity,
    });
  }

  const added = dishAdditions.length + productAdditions.length;

  if (added === 0) {
    throw new BadRequestException("None of those items are available right now");
  }

  await clearBasket(userId);

  for (const addition of dishAdditions) {
    await addItem(userId, addition);
  }

  for (const addition of productAdditions) {
    await addProduct(userId, addition);
  }

  return { added, skipped };
};

export const listOrders = (userId: string): Promise<OrderDocument[]> =>
  OrderModel.find({ userId }).select("+deliveryCode").sort({ createdAt: -1 }).limit(50).exec();

export const findOrder = async (userId: string, orderId: string): Promise<OrderDocument> => {
  const order = await OrderModel.findOne({ _id: orderId, userId })
    .select("+deliveryCode")
    .exec();

  if (!order) throw new NotFoundException("Order not found");

  return order;
};

/**
 * Confirms an order. Called only from a signature-verified webhook or from a
 * server-side status check — never from the client returning out of a sheet.
 *
 * Idempotent, because both providers may deliver the same event twice and the
 * reconciliation path can race the webhook. The status guard is what makes the
 * stock commit below safe to call here: it runs once per order, ever.
 */
export const markOrderPaid = async (
  providerPaymentId: string,
  lookup: { providerOrderId?: string } = {},
): Promise<void> => {
  const order = await OrderModel.findOne(
    lookup.providerOrderId
      ? { providerOrderId: lookup.providerOrderId }
      : { paymentIntentId: providerPaymentId },
  ).exec();

  if (!order) {
    logger.warn("Paid payment has no matching order", { providerPaymentId });

    return;
  }

  if (order.status !== "pending_payment" && order.status !== "payment_failed") return;

  order.paymentIntentId = providerPaymentId;
  order.paidAt = new Date();
  pushStatus(order, "confirmed", "Payment received");
  await order.save();

  await commitStock(order);

  // The basket has become an order; a stale one would re-checkout the same items.
  await clearBasket(order.userId.toString());
};

export const markOrderPaymentFailed = async (
  providerPaymentId: string,
  lookup: { providerOrderId?: string } = {},
): Promise<void> => {
  const order = await OrderModel.findOne(
    lookup.providerOrderId
      ? { providerOrderId: lookup.providerOrderId }
      : { paymentIntentId: providerPaymentId },
  ).exec();

  if (!order || order.status !== "pending_payment") return;

  pushStatus(order, "payment_failed", "Payment was not completed");
  await order.save();
};

/**
 * Reconciles one order against its provider. Used when the app returns from the
 * sheet before the webhook lands, and by any later retry: the verdict is read
 * from the provider, so the client still cannot mark its own order paid.
 */
export const syncOrderPayment = async (
  userId: string,
  orderId: string,
): Promise<OrderDocument> => {
  const order = await findOrder(userId, orderId);

  if (order.status !== "pending_payment") return order;

  const { paymentId, verdict } = await fetchPaymentVerdict(order);

  if (verdict === "paid" && paymentId) {
    await markOrderPaid(paymentId, { providerOrderId: order.providerOrderId });
  } else if (verdict === "failed") {
    await markOrderPaymentFailed(paymentId ?? "", { providerOrderId: order.providerOrderId });
  }

  return findOrder(userId, orderId);
};

/**
 * Confirms an order from the checkout callback.
 *
 * This exists so a customer is not left staring at a spinner while waiting for
 * a webhook that may take seconds. It is not a shortcut around verification:
 * the signature is checked, then the payment status is read from Razorpay
 * itself, and only then is the shared `markOrderPaid` path used.
 */
export const verifyOrderPayment = async (
  userId: string,
  orderId: string,
  input: VerifyPaymentInput,
): Promise<OrderDocument> => {
  const order = await findOrder(userId, orderId);

  if (order.providerOrderId !== input.razorpayOrderId) {
    throw new BadRequestException("Payment could not be verified");
  }

  const { paymentId, verdict } = await verifyRazorpayCallback(input);

  if (verdict === "paid") {
    await markOrderPaid(paymentId, { providerOrderId: order.providerOrderId });
  } else if (verdict === "failed") {
    await markOrderPaymentFailed(paymentId, { providerOrderId: order.providerOrderId });
  }

  return findOrder(userId, orderId);
};

/**
 * Records cash taken at the door. Called from the rider's delivery completion,
 * which already proves presence via the delivery code, so there is no separate
 * authorisation here.
 */
export const markCodCollected = async (order: OrderDocument): Promise<void> => {
  if (order.paymentMethod !== "cod" || order.codCollectedAt) return;

  order.codCollectedAt = new Date();
  order.codAmountDue = 0;
  order.paidAt = order.paidAt ?? new Date();
  await order.save();
};
