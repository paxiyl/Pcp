import mongoose from "mongoose";

import { OrderDocument, OrderModel, OrderStatus } from "../models/order.model";
import { ProductDocument, ProductModel } from "../models/product.model";
import { StoreDocument, StoreModel } from "../models/store.model";
import { UserDocument } from "../models/user.model";
import { BadRequestException, ForbiddenException, NotFoundException } from "../utils/app-error";

/**
 * Everything a shopkeeper can do, scoped to their own shop.
 *
 * The scoping rule is the whole point of this file: every query is filtered by
 * the store attached to the signed-in account, and nothing takes a storeId from
 * the client. A shopkeeper who could pass an id would be able to read the
 * neighbouring kirana's order book.
 */

/** The store this account runs, or a clear refusal. */
export const resolveOwnStore = async (user: UserDocument): Promise<StoreDocument> => {
  if (!user.storeId) {
    throw new ForbiddenException(
      "This account is not linked to a shop yet. Ask OnlineMall support to connect it.",
    );
  }

  const store = await StoreModel.findById(user.storeId).exec();

  if (!store) throw new NotFoundException("Store not found");

  return store;
};

/** Statuses a shop still has work to do on. */
const OPEN_STATUSES: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery"];

export type StoreOwnerOverview = {
  store: StoreDocument;
  /** Orders needing attention right now, newest first. */
  openOrders: OrderDocument[];
  today: { orders: number; revenue: number };
  /** Products at or below the threshold, so a shelf gap is noticed before a customer finds it. */
  lowStock: ProductDocument[];
  outOfStock: number;
};

const LOW_STOCK_AT = 5;

export const getOverview = async (user: UserDocument): Promise<StoreOwnerOverview> => {
  const store = await resolveOwnStore(user);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // `sanitizeFilter` is on globally, so these server-authored operators have to
  // be marked trusted or Mongoose casts them to literals and matches nothing.
  const [openOrders, todayOrders, lowStock, outOfStock] = await Promise.all([
    OrderModel.find({
      status: mongoose.trusted({ $in: OPEN_STATUSES }),
      storeId: store._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec(),
    OrderModel.find({
      createdAt: mongoose.trusted({ $gte: startOfDay }),
      // Cancelled and unpaid orders are not takings.
      status: mongoose.trusted({ $nin: ["cancelled", "payment_failed", "pending_payment"] }),
      storeId: store._id,
    })
      .select("total")
      .exec(),
    ProductModel.find({
      isAvailable: true,
      stock: mongoose.trusted({ $gt: 0, $lte: LOW_STOCK_AT }),
      storeId: store._id,
    })
      .sort({ stock: 1 })
      .limit(20)
      .exec(),
    ProductModel.countDocuments({
      isAvailable: true,
      stock: 0,
      storeId: store._id,
    }).exec(),
  ]);

  return {
    lowStock,
    openOrders,
    outOfStock,
    store,
    today: {
      orders: todayOrders.length,
      revenue: todayOrders.reduce((total, order) => total + order.total, 0),
    },
  };
};

export const listOrders = async (
  user: UserDocument,
  status?: OrderStatus,
): Promise<OrderDocument[]> => {
  const store = await resolveOwnStore(user);

  return OrderModel.find({
    storeId: store._id,
    ...(status ? { status } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .exec();
};

/**
 * The only transitions a shop owns.
 *
 * Deliberately NOT a free status setter. Dispatch and delivery belong to the
 * rider, and payment belongs to the gateway — a shop that could mark an order
 * delivered could close out an order that never left the counter.
 */
const SHOP_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["preparing"],
  preparing: ["ready"],
};

export const advanceOrder = async (
  user: UserDocument,
  orderId: string,
  next: OrderStatus,
): Promise<OrderDocument> => {
  const store = await resolveOwnStore(user);

  const order = await OrderModel.findOne({ _id: orderId, storeId: store._id }).exec();

  // Scoped lookup, so another shop's order reads as "not found" rather than
  // "forbidden" — which would confirm it exists.
  if (!order) throw new NotFoundException("Order not found");

  // Indexed through an explicit OrderStatus so the lookup is checked rather
  // than widened to any.
  const allowed = SHOP_TRANSITIONS[order.status as OrderStatus] ?? [];

  if (!allowed.includes(next)) {
    throw new BadRequestException(`You cannot move an order from ${order.status} to ${next}`);
  }

  order.status = next;
  order.statusHistory.push({ at: new Date(), status: next } as never);
  await order.save();

  return order;
};

export const listProducts = async (
  user: UserDocument,
  search?: string,
): Promise<ProductDocument[]> => {
  const store = await resolveOwnStore(user);

  const filter: Record<string, unknown> = { storeId: store._id };

  if (search) {
    const matches = mongoose.trusted({
      $options: "i",
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    });

    filter.$or = [{ name: matches }, { brand: matches }];
  }

  return ProductModel.find(filter).sort({ stock: 1, name: 1 }).limit(200).exec();
};

/**
 * A shopkeeper may change what is on the shelf and whether it is listed — but
 * NOT the price.
 *
 * Pricing is a commercial agreement between the shop and OnlineMall, and letting
 * it move from a phone means a basket's total can change between the customer
 * adding an item and paying for it. Price edits stay in the backoffice.
 */
export const updateStock = async (
  user: UserDocument,
  productId: string,
  input: { stock?: number; isAvailable?: boolean },
): Promise<ProductDocument> => {
  const store = await resolveOwnStore(user);

  const product = await ProductModel.findOne({ _id: productId, storeId: store._id }).exec();

  if (!product) throw new NotFoundException("Product not found");

  if (input.stock !== undefined) product.stock = input.stock;
  if (input.isAvailable !== undefined) product.isAvailable = input.isAvailable;

  await product.save();

  return product;
};

/** Open and closed is the shop's own call; being listed at all is the admin's. */
export const setOpen = async (user: UserDocument, isOpen: boolean): Promise<StoreDocument> => {
  const store = await resolveOwnStore(user);

  store.isOpen = isOpen;
  await store.save();

  return store;
};
