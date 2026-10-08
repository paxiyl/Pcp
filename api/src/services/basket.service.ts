import { Types } from "mongoose";

import { BasketDocument, BasketModel } from "../models/basket.model";
import { DishDocument, DishModel } from "../models/dish.model";
import { ProductDocument, ProductModel } from "../models/product.model";
import { RestaurantDocument, RestaurantModel } from "../models/restaurant.model";
import { StoreDocument, StoreModel } from "../models/store.model";
import {
  BasketPaymentOptions,
  BasketPayload,
  BasketTotals,
  VendorFees,
  VendorSummary,
} from "../types/basket.types";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  AddBasketItemInput,
  AddBasketProductInput,
  BasketSettingsInput,
} from "../validators/basket.validator";
import { codAvailability } from "./payment.service";
import { getServiceFeeRate } from "./settings.service";

const EMPTY_TOTALS: BasketTotals = {
  amountToFreeDelivery: null,
  belowMinimum: false,
  deliveryFee: 0,
  freeDeliveryThreshold: null,
  itemCount: 0,
  minOrder: 0,
  savings: 0,
  serviceFee: 0,
  subtotal: 0,
  total: 0,
};

const feesFromRestaurant = (restaurant: RestaurantDocument): VendorFees => ({
  deliveryFee: restaurant.deliveryFee,
  freeDeliveryThreshold: restaurant.freeDeliveryThreshold ?? null,
  minOrder: restaurant.minOrder,
});

const feesFromStore = (store: StoreDocument): VendorFees => ({
  deliveryFee: store.deliveryFee,
  freeDeliveryThreshold: store.freeDeliveryThreshold ?? null,
  minOrder: store.minOrder,
});

const summariseRestaurant = (restaurant: RestaurantDocument): VendorSummary => ({
  etaMinutes: restaurant.prepTimeMaxMinutes,
  id: restaurant._id.toString(),
  imageUrl: restaurant.imageUrl,
  isOpen: restaurant.isOpen,
  kind: "restaurant",
  name: restaurant.name,
});

const summariseStore = (store: StoreDocument): VendorSummary => ({
  etaMinutes: store.etaMinutes,
  id: store._id.toString(),
  imageUrl: store.imageUrl,
  isOpen: store.isOpen,
  kind: "store",
  name: store.name,
});

/**
 * Every money figure the client shows is computed here from stored unit prices
 * and the vendor's own fees. Nothing about totals is taken from the client.
 *
 * Takes `VendorFees` rather than a restaurant, so a store basket and a restaurant
 * basket run through one path and the free-delivery rule exists once.
 */
export const computeTotals = (
  basket: BasketDocument | null,
  fees: VendorFees | null,
  /** The platform rate, read from settings so one number drives every surface. */
  serviceFeeRate: number,
): BasketTotals => {
  if (!basket || !fees || basket.items.length === 0) return EMPTY_TOTALS;

  const subtotal = basket.items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const itemCount = basket.items.reduce((count, item) => count + item.quantity, 0);

  // Only store lines carry an MRP, so a restaurant basket reports no savings
  // rather than a misleading zero-discount line.
  const savings = basket.items.reduce(
    (total, item) => total + Math.max(0, (item.mrp ?? item.unitPrice) - item.unitPrice) * item.quantity,
    0,
  );

  const threshold = fees.freeDeliveryThreshold;
  const earnedFreeDelivery = threshold !== null && subtotal >= threshold;
  const deliveryFee = earnedFreeDelivery ? 0 : fees.deliveryFee;
  const serviceFee = Math.round(subtotal * serviceFeeRate);

  return {
    amountToFreeDelivery: threshold !== null && !earnedFreeDelivery ? threshold - subtotal : null,
    belowMinimum: subtotal < fees.minOrder,
    deliveryFee,
    freeDeliveryThreshold: threshold,
    itemCount,
    minOrder: fees.minOrder,
    savings,
    serviceFee,
    subtotal,
    total: subtotal + deliveryFee + serviceFee,
  };
};

/** Loads whichever vendor the basket belongs to, in one round trip. */
const loadVendor = async (
  basket: BasketDocument | null,
): Promise<{ restaurant: RestaurantDocument | null; store: StoreDocument | null }> => {
  if (!basket) return { restaurant: null, store: null };

  if (basket.vendorKind === "store" && basket.storeId) {
    return { restaurant: null, store: await StoreModel.findById(basket.storeId).exec() };
  }

  if (basket.restaurantId) {
    return { restaurant: await RestaurantModel.findById(basket.restaurantId).exec(), store: null };
  }

  return { restaurant: null, store: null };
};

const NO_COD: BasketPaymentOptions = {
  codAvailable: false,
  codMaxOrderValue: 0,
};

const withTotals = async (basket: BasketDocument | null): Promise<BasketPayload> => {
  const [{ restaurant, store }, serviceFeeRate] = await Promise.all([
    loadVendor(basket),
    getServiceFeeRate(),
  ]);

  const fees = store ? feesFromStore(store) : restaurant ? feesFromRestaurant(restaurant) : null;
  const vendor = store ? summariseStore(store) : restaurant ? summariseRestaurant(restaurant) : null;
  const totals = computeTotals(basket, fees, serviceFeeRate);

  // Decided here rather than at checkout, so the picker can grey the option out
  // with a reason instead of accepting it and refusing on submit.
  let payment = NO_COD;

  if (basket && totals.total > 0) {
    const cod = await codAvailability(basket.userId.toString(), totals.total);

    payment = {
      codAvailable: cod.available,
      codMaxOrderValue: cod.maxOrderValue,
      codUnavailableReason: cod.reason,
    };
  }

  return { basket, payment, restaurant, store, totals, vendor };
};

export const getBasket = async (userId: string): Promise<BasketPayload> => {
  const basket = await BasketModel.findOne({ userId }).exec();

  return withTotals(basket);
};

/**
 * Prices the requested options against the dish itself, so a client cannot ask
 * for a large pizza at the small price or invent an option that does not exist.
 */
export const priceSelection = (dish: DishDocument, optionIds: string[]) => {
  const chosen = new Set(optionIds);
  const names: string[] = [];
  const ids: Types.ObjectId[] = [];
  let extra = 0;

  for (const group of dish.optionGroups) {
    const selectedInGroup = group.options.filter((option) => chosen.has(option._id.toString()));

    if (group.required && selectedInGroup.length === 0) {
      throw new BadRequestException(`Choose an option for "${group.name}"`);
    }

    if (group.type === "single" && selectedInGroup.length > 1) {
      throw new BadRequestException(`Only one choice is allowed for "${group.name}"`);
    }

    for (const option of selectedInGroup) {
      names.push(option.name);
      ids.push(option._id);
      extra += option.priceDelta;
      chosen.delete(option._id.toString());
    }
  }

  if (chosen.size > 0) {
    throw new BadRequestException("That option is not available for this dish");
  }

  return { optionIds: ids, optionNames: names, unitPrice: dish.price + extra };
};

export const findAvailableDish = (dishId: string) =>
  DishModel.findOne({ _id: dishId, isAvailable: true }).exec();

/**
 * Resolves stored option names back to the dish's current option ids. Orders
 * placed before option ids were recorded only have names, and a customer should
 * still be able to reorder them.
 */
export const optionIdsFromNames = (dish: DishDocument, optionNames: string[]) => {
  const wanted = new Set(optionNames);
  const ids: string[] = [];

  for (const group of dish.optionGroups) {
    for (const option of group.options) {
      if (wanted.has(option.name)) ids.push(option._id.toString());
    }
  }

  return ids;
};

const sameLine = (item: {
  optionIds: Types.ObjectId[];
  dishId?: Types.ObjectId;
  productId?: Types.ObjectId;
  note?: string;
}) =>
  [
    item.dishId?.toString() ?? item.productId?.toString() ?? "",
    [...item.optionIds].map(String).sort().join("|"),
    item.note ?? "",
  ].join("::");

/**
 * Starts a fresh basket for a new vendor, or returns the existing one.
 *
 * One basket holds one vendor. That is a deliberate limit and not a technical
 * one: a single rider collects a single order from a single counter, which is how
 * every quick-commerce operation in India actually runs. Line items already carry
 * their own vendor reference, so allowing several is a change to this function and
 * to order creation, not to stored data.
 */
const resetIfVendorChanged = <T extends BasketDocument>(
  // Generic over the document type so a hydrated basket goes in and the same
  // hydrated basket comes back out. Widening to BasketDocument here loses the
  // Mongoose document fields and the result no longer fits the caller.
  basket: T | null,
  kind: "restaurant" | "store",
  vendorId: Types.ObjectId,
): T | null => {
  if (!basket) return null;

  const current =
    basket.vendorKind === "store" ? basket.storeId?.toString() : basket.restaurantId?.toString();

  if (basket.vendorKind === kind && current === vendorId.toString()) return basket;

  basket.vendorKind = kind;
  basket.restaurantId = kind === "restaurant" ? vendorId : undefined;
  basket.storeId = kind === "store" ? vendorId : undefined;
  basket.items = [];
  basket.orderNote = "";

  return basket;
};

export const addItem = async (
  userId: string,
  input: AddBasketItemInput,
): Promise<BasketPayload> => {
  const dish = await DishModel.findOne({ _id: input.dishId, isAvailable: true }).exec();

  if (!dish) throw new NotFoundException("Dish not found");

  const restaurant = await RestaurantModel.findOne({
    _id: dish.restaurantId,
    isActive: true,
  }).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  const priced = priceSelection(dish, input.optionIds ?? []);
  const note = input.note?.trim() || undefined;

  let basket = await BasketModel.findOne({ userId }).exec();

  basket = resetIfVendorChanged(basket, "restaurant", restaurant._id);

  if (!basket) {
    basket = new BasketModel({
      items: [],
      restaurantId: restaurant._id,
      userId,
      vendorKind: "restaurant",
    });
  }

  const candidate = {
    dishId: dish._id,
    imageUrl: dish.imageUrl,
    name: dish.name,
    note,
    optionIds: priced.optionIds,
    optionNames: priced.optionNames,
    quantity: input.quantity ?? 1,
    restaurantId: restaurant._id,
    unitPrice: priced.unitPrice,
  };

  const existing = basket.items.find((item) => sameLine(item) === sameLine(candidate));

  if (existing) {
    existing.quantity += candidate.quantity;
  } else {
    basket.items.push(candidate as never);
  }

  await basket.save();

  return withTotals(basket);
};

/**
 * Prescription-only medicine cannot be put in a basket yet.
 *
 * Dispensing Schedule H drugs in India requires a valid prescription and a
 * registered pharmacist, and OnlineMall has neither a prescription-upload flow
 * nor a verification step. Until both exist, the correct behaviour is to refuse
 * the add outright rather than take the order and work it out later.
 *
 * This is a server-side guard on purpose: a flag the client is trusted to honour
 * is one forgotten `if` away from dispensing antibiotics to anyone who asks.
 */
const assertDispensable = (product: ProductDocument) => {
  if (product.requiresPrescription) {
    throw new BadRequestException(
      `${product.name} needs a valid prescription. Please visit the pharmacy counter to collect it.`,
    );
  }
};

/** One place that decides whether a requested quantity is allowed. */
const assertStock = (product: ProductDocument, requested: number) => {
  if (product.stock <= 0) {
    throw new BadRequestException(`${product.name} is out of stock`);
  }

  if (requested > product.stock) {
    throw new BadRequestException(
      `Only ${product.stock} left of ${product.name}`,
    );
  }

  if (requested > product.maxPerOrder) {
    throw new BadRequestException(
      `You can order up to ${product.maxPerOrder} of ${product.name} at a time`,
    );
  }
};

/**
 * Adds a packaged product. Unlike a dish, a product has finite stock, so the
 * quantity being requested is checked against the shelf — including whatever is
 * already in the basket, which is the case a naive check misses.
 */
export const addProduct = async (
  userId: string,
  input: AddBasketProductInput,
): Promise<BasketPayload> => {
  const product = await ProductModel.findOne({
    _id: input.productId,
    isAvailable: true,
  }).exec();

  if (!product) throw new NotFoundException("Product not found");

  assertDispensable(product);

  const store = await StoreModel.findOne({ _id: product.storeId, isActive: true }).exec();

  if (!store) throw new NotFoundException("Store not found");

  const wanted = input.quantity ?? 1;

  let basket = await BasketModel.findOne({ userId }).exec();

  basket = resetIfVendorChanged(basket, "store", store._id);

  if (!basket) {
    basket = new BasketModel({ items: [], storeId: store._id, userId, vendorKind: "store" });
  }

  const candidate = {
    imageUrl: product.imageUrl,
    mrp: product.mrp,
    name: product.name,
    optionIds: [],
    optionNames: [],
    productId: product._id,
    quantity: wanted,
    storeId: store._id,
    unit: product.unit,
    unitPrice: product.price,
  };

  const existing = basket.items.find((item) => sameLine(item) === sameLine(candidate));
  const alreadyHeld = existing?.quantity ?? 0;

  assertStock(product, alreadyHeld + wanted);

  if (existing) {
    existing.quantity += wanted;
    // Re-price on every add: a product sitting in a basket for two days should
    // charge today's price, not the one captured when it was added.
    existing.unitPrice = product.price;
    existing.mrp = product.mrp;
  } else {
    basket.items.push(candidate as never);
  }

  await basket.save();

  return withTotals(basket);
};

export const setItemQuantity = async (
  userId: string,
  itemId: string,
  quantity: number,
): Promise<BasketPayload> => {
  const basket = await BasketModel.findOne({ userId }).exec();

  if (!basket) throw new NotFoundException("Basket not found");

  const item = basket.items.find((candidate) => candidate._id.toString() === itemId);

  if (!item) throw new NotFoundException("Item not found in your basket");

  // Raising the quantity of a product is a fresh claim on the shelf, so it is
  // checked again here rather than only on the way in.
  if (quantity > 0 && item.productId) {
    const product = await ProductModel.findById(item.productId).exec();

    if (!product) throw new NotFoundException("Product not found");

    assertStock(product, quantity);
  }

  if (quantity === 0) {
    basket.items = basket.items.filter((candidate) => candidate._id.toString() !== itemId);
  } else {
    item.quantity = quantity;
  }

  // An empty basket is no basket, so the next add starts clean.
  if (basket.items.length === 0) {
    await basket.deleteOne();

    return withTotals(null);
  }

  await basket.save();

  return withTotals(basket);
};

export const updateSettings = async (
  userId: string,
  input: BasketSettingsInput,
): Promise<BasketPayload> => {
  const basket = await BasketModel.findOne({ userId }).exec();

  if (!basket) throw new NotFoundException("Basket not found");

  if (input.includeCutlery !== undefined) basket.includeCutlery = input.includeCutlery;
  if (input.orderNote !== undefined) basket.orderNote = input.orderNote;

  await basket.save();

  return withTotals(basket);
};

export const clearBasket = async (userId: string): Promise<BasketPayload> => {
  await BasketModel.deleteOne({ userId }).exec();

  return withTotals(null);
};
