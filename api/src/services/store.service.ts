import mongoose from "mongoose";

import { ProductCategoryDocument, ProductCategoryModel } from "../models/product-category.model";
import { ProductDocument, ProductModel } from "../models/product.model";
import { StoreDocument, StoreModel } from "../models/store.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  ProductCategoryInput,
  ProductCategoryUpdateInput,
  ProductInput,
  ProductQuery,
  ProductUpdateInput,
  StoreInput,
  StoreQuery,
  StoreUpdateInput,
} from "../validators/store.validator";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toLocation = (input: { latitude?: number; longitude?: number }) =>
  input.latitude !== undefined && input.longitude !== undefined
    ? { coordinates: [input.longitude, input.latitude] as [number, number], type: "Point" as const }
    : undefined;

/**
 * Escapes a user search term so it can never smuggle in regex syntax, and marks
 * the operator trusted because `sanitizeFilter` would otherwise cast it to a
 * literal string. Same treatment the restaurant service gives its search.
 */
const searchMatcher = (term: string) =>
  mongoose.trusted({ $options: "i", $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") });

/* -------------------------------------------------------------------------- */
/* Stores                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Store discovery. Filters are built from validated fields only — the raw query
 * object never reaches Mongoose.
 */
export const listStores = async (query: StoreQuery): Promise<StoreDocument[]> => {
  const filter: Record<string, unknown> = { isActive: true };

  if (query.category) {
    const category = await ProductCategoryModel.findOne({ slug: query.category.toLowerCase() })
      .select("_id")
      .exec();

    // An unknown category matches nothing rather than silently returning everything.
    if (!category) return [];

    filter.categories = category._id;
  }

  if (query.storeType) filter.storeType = searchMatcher(query.storeType);
  if (query.area) filter.area = searchMatcher(query.area);

  if (query.search) {
    const matches = searchMatcher(query.search);

    filter.$or = [{ name: matches }, { storeType: matches }, { area: matches }];
  }

  // Open shops first: a closed store is still worth listing, but never above one
  // that can actually take the order right now.
  return StoreModel.find(filter)
    .sort({ isOpen: -1, sortOrder: 1, rating: -1 })
    .populate("categories", "name slug")
    .exec();
};

export const findStoreBySlug = async (
  slug: string,
): Promise<{ store: StoreDocument; products: ProductDocument[] }> => {
  const store = await StoreModel.findOne({ isActive: true, slug: slug.toLowerCase() })
    .populate("categories", "name slug")
    .exec();

  if (!store) throw new NotFoundException("Store not found");

  const products = await ProductModel.find({ storeId: store._id, isAvailable: true })
    .sort({ isPopular: -1, sortOrder: 1, name: 1 })
    .populate("categoryId", "name slug")
    .exec();

  return { products, store };
};

export const createStore = async (input: StoreInput): Promise<StoreDocument> => {
  const slug = input.slug ?? slugify(input.name);
  const clash = await StoreModel.findOne({ slug }).select("_id").exec();

  if (clash) throw new BadRequestException("A store with that name already exists");

  const { latitude, longitude, ...rest } = input;

  return StoreModel.create({ ...rest, location: toLocation(input), slug });
};

export const updateStore = async (
  id: string,
  input: StoreUpdateInput,
): Promise<StoreDocument> => {
  const store = await StoreModel.findById(id).exec();

  if (!store) throw new NotFoundException("Store not found");

  if (input.slug && input.slug !== store.slug) {
    const clash = await StoreModel.findOne({ slug: input.slug }).select("_id").exec();

    if (clash) throw new BadRequestException("That slug is already taken");
  }

  const { latitude, longitude, ...rest } = input;

  Object.assign(store, rest);

  if (latitude !== undefined || longitude !== undefined) {
    store.location = toLocation({
      latitude: latitude ?? store.location?.coordinates?.[1],
      longitude: longitude ?? store.location?.coordinates?.[0],
    });
  }

  await store.save();

  // The name is denormalised onto every product for the rails, so a rename has
  // to reach them or cards will show the old shop.
  if (input.name) {
    await ProductModel.updateMany({ storeId: store._id }, { storeName: store.name }).exec();
  }

  return store;
};

/**
 * Removing a store removes its shelf with it. Leaving the products behind would
 * orphan rows that still render in search and still price into a basket.
 */
export const deleteStore = async (id: string): Promise<void> => {
  const store = await StoreModel.findById(id).exec();

  if (!store) throw new NotFoundException("Store not found");

  await ProductModel.deleteMany({ storeId: store._id }).exec();
  await store.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

const SORTS: Record<string, Record<string, 1 | -1>> = {
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  popular: { isPopular: -1, sortOrder: 1 },
  rating: { rating: -1, ratingCount: -1 },
};

export const listProducts = async (
  query: ProductQuery,
): Promise<{ products: ProductDocument[]; total: number; page: number; pages: number }> => {
  const filter: Record<string, unknown> = { isAvailable: true };

  if (query.storeId) filter.storeId = query.storeId;

  // A grid shows one card per ARTICLE, not one per SKU. Without this a shirt in
  // four sizes and three colours fills a whole screen on its own. Products with
  // no group are unaffected: they default to isDefaultVariant true.
  if (!query.includeVariants) filter.isDefaultVariant = true;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.brand) filter.brand = searchMatcher(query.brand);
  if (query.excludePrescription) filter.requiresPrescription = false;
  if (query.inStockOnly) filter.stock = mongoose.trusted({ $gt: 0 });

  if (query.category) {
    const category = await ProductCategoryModel.findOne({ slug: query.category.toLowerCase() })
      .select("_id")
      .exec();

    if (!category) return { page: query.page, pages: 0, products: [], total: 0 };

    // A parent category shows everything beneath it, so tapping "Staples" does
    // not return an empty shelf just because every product sits in a child.
    const children = await ProductCategoryModel.find({ parentId: category._id })
      .select("_id")
      .exec();

    filter.categoryId = mongoose.trusted({
      $in: [category._id, ...children.map((child) => child._id)],
    });
  }

  if (query.search) {
    const matches = searchMatcher(query.search);

    filter.$or = [{ name: matches }, { brand: matches }, { tags: matches }];
  }

  const skip = (query.page - 1) * query.limit;

  // "discount" cannot be a plain sort key: the saving is derived from mrp and
  // price, so it is computed in the pipeline rather than stored and kept in sync.
  if (query.sort === "discount") {
    const [rows, total] = await Promise.all([
      ProductModel.aggregate([
        { $match: filter },
        { $addFields: { saving: { $subtract: ["$mrp", "$price"] } } },
        { $sort: { saving: -1, price: 1 } },
        { $skip: skip },
        { $limit: query.limit },
      ]).exec(),
      ProductModel.countDocuments(filter).exec(),
    ]);

    return {
      page: query.page,
      pages: Math.ceil(total / query.limit),
      products: rows as ProductDocument[],
      total,
    };
  }

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(SORTS[query.sort ?? "popular"] ?? SORTS.popular)
      .skip(skip)
      .limit(query.limit)
      .populate("categoryId", "name slug")
      .exec(),
    ProductModel.countDocuments(filter).exec(),
  ]);

  return {
    page: query.page,
    pages: Math.ceil(total / query.limit),
    products: await withVariantCounts(products),
    total,
  };
};

/**
 * One product, plus every sibling SKU of the same article so the detail screen
 * can offer sizes or shades without a second request.
 *
 * `variants` is empty for a product with no group, which is most of a grocery
 * catalogue — the UI simply renders no selector.
 */
/**
 * Attaches how many SKUs each article has, so a card can say "4 sizes" instead
 * of a pack size that means nothing for a shirt.
 *
 * One grouped query for the whole page rather than one per card: a 24-product
 * grid would otherwise fire 24 counts. Products with no group are untouched and
 * the field is simply absent.
 */
const withVariantCounts = async (products: ProductDocument[]): Promise<ProductDocument[]> => {
  const groupIds = products
    .map((product) => product.variantGroupId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  if (groupIds.length === 0) return products;

  const counts = await ProductModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { isAvailable: true, variantGroupId: { $in: groupIds } } }, // aggregate: not filtered by sanitizeFilter
    { $group: { _id: "$variantGroupId", count: { $sum: 1 } } },
  ]).exec();

  const byGroup = new Map<string, number>(
    counts.map((row) => [row._id.toString(), Number(row.count) || 0]),
  );

  return products.map((product) => {
    const count = product.variantGroupId
      ? byGroup.get(product.variantGroupId.toString())
      : undefined;

    // toJSON so the extra field survives serialisation; Mongoose documents drop
    // anything that is not in the schema.
    return (count && count > 1
      ? Object.assign(product.toJSON(), { variantCount: count })
      : product) as ProductDocument;
  });
};

export const findProductById = async (
  id: string,
): Promise<{
  product: ProductDocument;
  store: StoreDocument | null;
  variants: ProductDocument[];
}> => {
  const product = await ProductModel.findById(id)
    .populate("categoryId", "name slug")
    .exec();

  if (!product) throw new NotFoundException("Product not found");

  const [store, variants] = await Promise.all([
    StoreModel.findById(product.storeId).exec(),
    product.variantGroupId
      ? ProductModel.find({
          isAvailable: true,
          variantGroupId: product.variantGroupId,
        })
          // Sold-out sizes stay in the list, greyed, rather than vanishing: a
          // missing M reads as "we never had it" instead of "it went".
          .sort({ sortOrder: 1, name: 1 })
          .exec()
      : Promise.resolve([]),
  ]);

  return { product, store, variants };
};

export const createProduct = async (
  storeId: string,
  input: ProductInput,
): Promise<ProductDocument> => {
  const store = await StoreModel.findById(storeId).exec();

  if (!store) throw new NotFoundException("Store not found");

  const category = await ProductCategoryModel.findById(input.categoryId).select("_id").exec();

  if (!category) throw new NotFoundException("Category not found");

  const slug = input.slug ?? slugify(`${input.name} ${input.unit}`);
  const clash = await ProductModel.findOne({ slug, storeId: store._id }).select("_id").exec();

  if (clash) throw new BadRequestException("This store already stocks that product");

  return ProductModel.create({
    ...input,
    // Absent MRP means the product simply is not discounted.
    mrp: input.mrp ?? input.price,
    slug,
    storeId: store._id,
    storeName: store.name,
  });
};

export const updateProduct = async (
  id: string,
  input: ProductUpdateInput,
): Promise<ProductDocument> => {
  const product = await ProductModel.findById(id).exec();

  if (!product) throw new NotFoundException("Product not found");

  if (input.categoryId) {
    const category = await ProductCategoryModel.findById(input.categoryId).select("_id").exec();

    if (!category) throw new NotFoundException("Category not found");
  }

  if (input.slug && input.slug !== product.slug) {
    const clash = await ProductModel.findOne({
      _id: mongoose.trusted({ $ne: product._id }),
      slug: input.slug,
      storeId: product.storeId,
    })
      .select("_id")
      .exec();

    if (clash) throw new BadRequestException("This store already stocks that product");
  }

  Object.assign(product, input);
  await product.save();

  return product;
};

export const deleteProduct = async (id: string): Promise<void> => {
  const product = await ProductModel.findById(id).exec();

  if (!product) throw new NotFoundException("Product not found");

  await product.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* Product categories                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns the tree with a live product count per category, because a category
 * tile that opens onto an empty shelf is worse than no tile at all.
 */
export const listProductCategories = async (): Promise<
  (ProductCategoryDocument & { productCount: number })[]
> => {
  const categories = await ProductCategoryModel.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .exec();

  const counts = await ProductModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { isAvailable: true } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]).exec();

  // Typed explicitly: the aggregate's shape is asserted, not inferred, so a
  // missing count can never silently poison the arithmetic below.
  const byId = new Map<string, number>(
    counts.map((row) => [row._id.toString(), Number(row.count) || 0]),
  );

  // A parent's count includes its children's, so "Staples" reads 40 rather than 0.
  const childTotals = new Map<string, number>();

  for (const category of categories) {
    if (!category.parentId) continue;

    const parent = category.parentId.toString();

    childTotals.set(
      parent,
      (childTotals.get(parent) ?? 0) + (byId.get(category._id.toString()) ?? 0),
    );
  }

  return categories.map((category) => {
    const id = category._id.toString();

    return Object.assign(category.toJSON(), {
      productCount: (byId.get(id) ?? 0) + (childTotals.get(id) ?? 0),
    });
  }) as (ProductCategoryDocument & { productCount: number })[];
};

export const createProductCategory = async (
  input: ProductCategoryInput,
): Promise<ProductCategoryDocument> => {
  const slug = input.slug ?? slugify(input.name);
  const clash = await ProductCategoryModel.findOne({ slug }).select("_id").exec();

  if (clash) throw new BadRequestException("A category with that name already exists");

  if (input.parentId) {
    const parent = await ProductCategoryModel.findById(input.parentId).exec();

    if (!parent) throw new NotFoundException("Parent category not found");

    // Two levels only. A deeper tree needs a navigation design that does not
    // exist, and would silently produce categories nothing can reach.
    if (parent.parentId) throw new BadRequestException("Categories can only nest one level deep");
  }

  return ProductCategoryModel.create({ ...input, slug });
};

export const updateProductCategory = async (
  id: string,
  input: ProductCategoryUpdateInput,
): Promise<ProductCategoryDocument> => {
  const category = await ProductCategoryModel.findById(id).exec();

  if (!category) throw new NotFoundException("Category not found");

  if (input.parentId) {
    if (input.parentId === id) throw new BadRequestException("A category cannot be its own parent");

    const parent = await ProductCategoryModel.findById(input.parentId).exec();

    if (!parent) throw new NotFoundException("Parent category not found");
    if (parent.parentId) throw new BadRequestException("Categories can only nest one level deep");
  }

  Object.assign(category, input);
  await category.save();

  return category;
};

/**
 * A category holding products or children is not deleted silently — the admin is
 * told what is in the way, because the alternative is orphaned products that no
 * category page can reach.
 */
export const deleteProductCategory = async (id: string): Promise<void> => {
  const category = await ProductCategoryModel.findById(id).exec();

  if (!category) throw new NotFoundException("Category not found");

  const [products, children] = await Promise.all([
    ProductModel.countDocuments({ categoryId: category._id }).exec(),
    ProductCategoryModel.countDocuments({ parentId: category._id }).exec(),
  ]);

  if (products > 0) {
    throw new BadRequestException(
      `${products} product${products === 1 ? "" : "s"} still use this category`,
    );
  }

  if (children > 0) {
    throw new BadRequestException("Remove the sub-categories first");
  }

  await category.deleteOne();
};
