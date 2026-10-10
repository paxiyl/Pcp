import { Document, model, Schema, Types } from "mongoose";
import { PRESET_KEYS } from "../config/image-presets";

/**
 * A packaged SKU on a store's shelf.
 *
 * OnlineMall sells groceries, medicine, cosmetics, clothing, electronics and
 * household goods, so this row has to cover all of them. Two things make that
 * work without a second model:
 *
 * VARIANTS. A row is always ONE sellable SKU — a Medium Blue t-shirt, not "the
 * t-shirt". Siblings are linked by `variantGroupId` and the listing collapses a
 * group to its default. This is how retail actually works: stock, price and
 * barcode all belong to the variant, not the garment. Crucially it needs NO
 * change to the basket or the order — a line already points at one product.
 *
 * PRESCRIPTION. Schedule H medicine cannot lawfully be dispensed without a
 * prescription, so the flag lives on the product and is enforced server-side at
 * add-to-basket rather than being a badge the UI can forget to draw.
 *
 * Two things make this different from a dish:
 *
 * 1. `mrp` and `price` are stored separately. MRP is what is printed on the pack
 *    and is a legal figure in India; `price` is what the customer pays. The
 *    discount is always DERIVED from the pair, never stored, so a badge can never
 *    drift out of agreement with the price next to it.
 * 2. `stock` is real. A dish is available or not; a pack of atta runs out. The
 *    stepper on the product card is capped by this, so a basket can never hold
 *    more than the shop has.
 */
export interface ProductDocument extends Document {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  /** Denormalised so a product rail renders without a second query per card. */
  storeName: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /**
   * A preset tile key, used when there is no photograph. Kept alongside
   * `imageUrl` rather than written into it: a URL is a picture of this item, a
   * preset is an admission that we do not have one, and the clients draw them
   * differently.
   */
  imagePreset?: string;
  imagePublicId?: string;
  /**
   * Pack size exactly as printed: "1 kg", "500 ml", "Pack of 6". For goods sold
   * by the piece — a shirt, a lipstick — this is the variant in words ("Medium",
   * "Shade 04") or simply "1 piece".
   */
  unit: string;
  brand: string;
  categoryId: Types.ObjectId;
  /** Minor units (paise). What the customer pays. */
  price: number;
  /** Minor units (paise). Printed MRP; equals price when there is no discount. */
  mrp: number;
  rating: number;
  ratingCount: number;
  /** Units on the shelf. 0 renders the card as sold out. */
  stock: number;
  /** Caps the stepper. Keeps one customer from clearing a shelf. */
  maxPerOrder: number;
  isAvailable: boolean;
  isPopular: boolean;
  /** Merchandising only — "Bestseller", "New", "Local favourite". Not status. */
  tags: string[];

  /**
   * Shared by every SKU of the same article. Absent for a product with only one
   * version, which is most of a grocery catalogue — a 1 kg bag of atta is not a
   * "variant" of anything.
   */
  variantGroupId?: Types.ObjectId;
  /** What this variant is, in the customer's words: "M", "Blue", "Shade 04". */
  variantLabel?: string;
  /** What distinguishes the group: "Size", "Colour", "Shade", "Pack". */
  variantType?: string;
  /** The one shown in a grid on the group's behalf. Exactly one per group. */
  isDefaultVariant: boolean;

  /**
   * Schedule H / prescription-only medicine. Enforced in the basket service, not
   * merely displayed — see the note at the top of this file.
   */
  requiresPrescription: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    storeName: { type: String, default: "", trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: "", trim: true, maxlength: 600 },
    imageUrl: { type: String, default: "" },
    imagePreset: { type: String, enum: PRESET_KEYS },
    imagePublicId: { type: String },
    unit: { type: String, required: true, trim: true, maxlength: 40 },
    brand: { type: String, default: "", trim: true, maxlength: 60, index: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ProductCategory",
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    maxPerOrder: { type: Number, default: 10, min: 1 },
    isAvailable: { type: Boolean, default: true, index: true },
    isPopular: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },

    variantGroupId: { type: Schema.Types.ObjectId, index: true },
    variantLabel: { type: String, trim: true, maxlength: 40 },
    variantType: { type: String, trim: true, maxlength: 30 },
    isDefaultVariant: { type: Boolean, default: true },

    requiresPrescription: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, record) => {
        const { __v, ...safe } = record as Record<string, unknown>;

        return safe;
      },
    },
  },
);

/**
 * A price above the printed MRP is not a pricing decision, it is a data entry
 * mistake, and it would render a negative discount badge. Clamped at the model so
 * a seed script or an admin edit cannot introduce one.
 */
productSchema.pre("validate", function clampPriceToMrp() {
  if (this.mrp < this.price) this.mrp = this.price;
});

// One slug per store, not globally: two kiranas may both stock "aashirvaad-atta-1kg".
productSchema.index({ storeId: 1, slug: 1 }, { unique: true });
productSchema.index({ name: "text", brand: "text", tags: "text" });
// Grids collapse a group to its default, so this pair is the hot path for every
// category page and product rail in the app.
productSchema.index({ variantGroupId: 1, isDefaultVariant: -1 });

export const ProductModel = model<ProductDocument>("Product", productSchema);
