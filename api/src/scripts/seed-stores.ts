import { Types } from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { ProductCategoryModel } from "../models/product-category.model";
import { ProductModel } from "../models/product.model";
import { StoreModel } from "../models/store.model";
import { logger } from "../utils/logger";

/**
 * Seeds the Hindaun product catalogue: categories, local stores, and a shelf for
 * each one.
 *
 * Money is in PAISE throughout, matching the rest of the platform. MRPs are the
 * printed pack prices you would actually see in a Hindaun kirana; `price` is the
 * selling price. The gap between them is what renders the discount badge, so the
 * two are never equal unless the product genuinely has no offer.
 *
 * Images are left empty on purpose. The product card falls back to the muted tile
 * rather than showing a broken remote image, and seeding hotlinked photographs
 * would put someone else's copyrighted product shots in the database. Fill them
 * in from the admin, or extend this script the way seed-categories.ts uploads to
 * Cloudinary.
 *
 * Idempotent: re-running updates in place rather than duplicating the catalogue.
 *
 * Run with: npm run seed:stores
 */

type SeedCategory = {
  name: string;
  slug: string;
  backgroundColor: string;
  sortOrder: number;
  parent?: string;
};

const categories: SeedCategory[] = [
  { backgroundColor: "#E8F6EC", name: "Fruits & Vegetables", slug: "fruits-vegetables", sortOrder: 1 },
  { backgroundColor: "#FDF2E3", name: "Staples", slug: "staples", sortOrder: 2 },
  { backgroundColor: "#EAF0FE", name: "Dairy & Bakery", slug: "dairy-bakery", sortOrder: 3 },
  { backgroundColor: "#FDEEE7", name: "Snacks & Namkeen", slug: "snacks-namkeen", sortOrder: 4 },
  { backgroundColor: "#F1EBFD", name: "Beverages", slug: "beverages", sortOrder: 5 },
  { backgroundColor: "#E7F6EC", name: "Personal Care", slug: "personal-care", sortOrder: 6 },
  { backgroundColor: "#FDF2E3", name: "Household", slug: "household", sortOrder: 7 },
  { backgroundColor: "#EAF0FE", name: "Electronics", slug: "electronics", sortOrder: 8 },
  { backgroundColor: "#FDEEE7", name: "Medicine", slug: "medicine", sortOrder: 9 },
  { backgroundColor: "#F1EBFD", name: "Beauty & Cosmetics", slug: "cosmetics", sortOrder: 10 },
  { backgroundColor: "#E8F6EC", name: "Clothing", slug: "clothing", sortOrder: 11 },
  { backgroundColor: "#FDF2E3", name: "Baby Care", slug: "baby-care", sortOrder: 12 },
  { backgroundColor: "#EAF0FE", name: "Stationery", slug: "stationery", sortOrder: 13 },
  { backgroundColor: "#E7F6EC", name: "Pet Supplies", slug: "pet-supplies", sortOrder: 14 },

  // Sub-categories. One level deep only, matching the service's limit.
  { backgroundColor: "#FDF2E3", name: "Atta & Flour", parent: "staples", slug: "atta-flour", sortOrder: 10 },
  { backgroundColor: "#FDF2E3", name: "Rice & Pulses", parent: "staples", slug: "rice-pulses", sortOrder: 11 },
  { backgroundColor: "#FDF2E3", name: "Oils & Ghee", parent: "staples", slug: "oils-ghee", sortOrder: 12 },
  { backgroundColor: "#FDF2E3", name: "Masala & Spices", parent: "staples", slug: "masala-spices", sortOrder: 13 },
];

type SeedProduct = {
  name: string;
  slug: string;
  unit: string;
  brand: string;
  category: string;
  /** Paise. */
  price: number;
  mrp: number;
  stock: number;
  isPopular?: boolean;
  tags?: string[];
  /** Siblings share this key; the script turns it into a real ObjectId. */
  group?: string;
  variantLabel?: string;
  variantType?: string;
  isDefaultVariant?: boolean;
  requiresPrescription?: boolean;
};

type SeedStore = {
  name: string;
  slug: string;
  storeType: string;
  description: string;
  area: string;
  address: string;
  etaMinutes: number;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold?: number;
  rating: number;
  ratingCount: number;
  closesAt: string;
  sortOrder: number;
  /** Hindaun City sits at roughly 26.73 N, 77.03 E. */
  latitude: number;
  longitude: number;
  products: SeedProduct[];
};

const stores: SeedStore[] = [
  {
    address: "Bazaar Road, near Ghanta Ghar, Hindaun City",
    area: "Bazaar",
    closesAt: "21:30",
    deliveryFee: 2500,
    description: "Everyday groceries, atta, pulses and cooking oil. Family-run since 1992.",
    etaMinutes: 15,
    freeDeliveryThreshold: 49900,
    latitude: 26.7331,
    longitude: 77.0335,
    minOrder: 9900,
    name: "Sharma Kirana Store",
    products: [
      { brand: "Aashirvaad", category: "atta-flour", mrp: 32500, name: "Aashirvaad Shudh Chakki Atta", price: 29900, slug: "aashirvaad-atta-5kg", stock: 40, unit: "5 kg", isPopular: true, tags: ["Bestseller"] },
      { brand: "Fortune", category: "atta-flour", mrp: 22000, name: "Fortune Chakki Fresh Atta", price: 19500, slug: "fortune-atta-5kg", stock: 25, unit: "5 kg" },
      { brand: "India Gate", category: "rice-pulses", mrp: 46000, name: "India Gate Basmati Rice Classic", price: 41900, slug: "india-gate-basmati-5kg", stock: 18, unit: "5 kg", isPopular: true },
      { brand: "Tata Sampann", category: "rice-pulses", mrp: 18500, name: "Tata Sampann Toor Dal", price: 16400, slug: "tata-sampann-toor-dal-1kg", stock: 32, unit: "1 kg" },
      { brand: "Rajdhani", category: "rice-pulses", mrp: 13500, name: "Rajdhani Chana Dal", price: 11900, slug: "rajdhani-chana-dal-1kg", stock: 28, unit: "1 kg" },
      { brand: "Fortune", category: "oils-ghee", mrp: 17500, name: "Fortune Kachi Ghani Mustard Oil", price: 15900, slug: "fortune-mustard-oil-1l", stock: 36, unit: "1 L", isPopular: true },
      { brand: "Amul", category: "oils-ghee", mrp: 68000, name: "Amul Pure Ghee", price: 63500, slug: "amul-ghee-1l", stock: 14, unit: "1 L", tags: ["Bestseller"] },
      { brand: "Everest", category: "masala-spices", mrp: 9000, name: "Everest Garam Masala", price: 8200, slug: "everest-garam-masala-100g", stock: 45, unit: "100 g" },
      { brand: "MDH", category: "masala-spices", mrp: 8500, name: "MDH Deggi Mirch", price: 7800, slug: "mdh-deggi-mirch-100g", stock: 38, unit: "100 g" },
      { brand: "Tata", category: "staples", mrp: 2800, name: "Tata Salt Iodised", price: 2600, slug: "tata-salt-1kg", stock: 60, unit: "1 kg" },
      { brand: "Madhur", category: "staples", mrp: 5800, name: "Madhur Refined Sugar", price: 5400, slug: "madhur-sugar-1kg", stock: 42, unit: "1 kg" },
    ],
    rating: 4.5,
    ratingCount: 218,
    slug: "sharma-kirana-store",
    sortOrder: 1,
    storeType: "Kirana",
  },
  {
    address: "Katkad Road, opposite Bus Stand, Hindaun City",
    area: "Katkad Road",
    closesAt: "22:00",
    deliveryFee: 1900,
    description: "Fresh milk, paneer, bread and cakes, delivered the same morning.",
    etaMinutes: 12,
    freeDeliveryThreshold: 29900,
    latitude: 26.7368,
    longitude: 77.0291,
    minOrder: 4900,
    name: "Gupta Dairy & Bakery",
    products: [
      { brand: "Amul", category: "dairy-bakery", mrp: 3400, name: "Amul Taaza Toned Milk", price: 3300, slug: "amul-taaza-1l", stock: 80, unit: "1 L", isPopular: true, tags: ["Daily"] },
      { brand: "Amul", category: "dairy-bakery", mrp: 9500, name: "Amul Malai Paneer", price: 8900, slug: "amul-paneer-200g", stock: 24, unit: "200 g" },
      { brand: "Amul", category: "dairy-bakery", mrp: 6200, name: "Amul Butter", price: 5800, slug: "amul-butter-100g", stock: 50, unit: "100 g", isPopular: true },
      { brand: "Mother Dairy", category: "dairy-bakery", mrp: 3000, name: "Mother Dairy Dahi", price: 2800, slug: "mother-dairy-dahi-400g", stock: 35, unit: "400 g" },
      { brand: "Britannia", category: "dairy-bakery", mrp: 5500, name: "Britannia Brown Bread", price: 5000, slug: "britannia-brown-bread", stock: 22, unit: "400 g" },
      { brand: "Local", category: "dairy-bakery", mrp: 4000, name: "Fresh Rusk Toast", price: 3500, slug: "fresh-rusk-toast-300g", stock: 30, unit: "300 g", tags: ["Local favourite"] },
    ],
    rating: 4.7,
    ratingCount: 342,
    slug: "gupta-dairy-bakery",
    sortOrder: 2,
    storeType: "Dairy",
  },
  {
    address: "Station Road, near Civil Hospital, Hindaun City",
    area: "Station Road",
    closesAt: "23:00",
    deliveryFee: 2500,
    description: "Licensed chemist. Medicines, baby care and daily personal care.",
    etaMinutes: 18,
    latitude: 26.7294,
    longitude: 77.0402,
    minOrder: 9900,
    name: "Jain Medical Store",
    products: [
      { brand: "Dettol", category: "personal-care", mrp: 9900, name: "Dettol Antiseptic Liquid", price: 9200, slug: "dettol-antiseptic-250ml", stock: 40, unit: "250 ml", isPopular: true },
      { brand: "Colgate", category: "personal-care", mrp: 11000, name: "Colgate Strong Teeth Toothpaste", price: 9900, slug: "colgate-strong-teeth-200g", stock: 55, unit: "200 g" },
      { brand: "Dove", category: "personal-care", mrp: 7500, name: "Dove Cream Beauty Bathing Bar", price: 6600, slug: "dove-soap-125g", stock: 48, unit: "125 g" },
      { brand: "Clinic Plus", category: "personal-care", mrp: 19900, name: "Clinic Plus Strong & Long Shampoo", price: 17500, slug: "clinic-plus-shampoo-340ml", stock: 26, unit: "340 ml", isPopular: true },
      { brand: "Himalaya", category: "personal-care", mrp: 25000, name: "Himalaya Baby Lotion", price: 22500, slug: "himalaya-baby-lotion-400ml", stock: 15, unit: "400 ml" },
      { brand: "Whisper", category: "personal-care", mrp: 18500, name: "Whisper Ultra Clean XL", price: 16900, slug: "whisper-ultra-xl-15s", stock: 20, unit: "Pack of 15" },
      // Over the counter: no prescription needed, sells like any other product.
      { brand: "Cipla", category: "medicine", mrp: 3000, name: "Paracetamol 500mg Tablets", price: 2800, slug: "paracetamol-500-15s", stock: 60, unit: "Strip of 15", tags: ["OTC"] },
      { brand: "Dabur", category: "medicine", mrp: 19500, name: "Dabur Honitus Cough Syrup", price: 17500, slug: "honitus-syrup-100ml", stock: 30, unit: "100 ml", tags: ["OTC"] },
      { brand: "Volini", category: "medicine", mrp: 16500, name: "Volini Pain Relief Gel", price: 14900, slug: "volini-gel-30g", stock: 25, unit: "30 g", tags: ["OTC"] },
      { brand: "Accu-Chek", category: "medicine", mrp: 115000, name: "Accu-Chek Active Glucometer", price: 99900, slug: "accuchek-active", stock: 6, unit: "1 unit" },
      // Schedule H: the API refuses to basket these until a prescription-upload
      // and pharmacist-verification flow exists. Seeded so that path is testable.
      { brand: "Cipla", category: "medicine", mrp: 13500, name: "Azithromycin 500mg Tablets", price: 12500, requiresPrescription: true, slug: "azithromycin-500-3s", stock: 20, unit: "Strip of 3" },
      { brand: "USV", category: "medicine", mrp: 4500, name: "Metformin 500mg Tablets", price: 4100, requiresPrescription: true, slug: "metformin-500-20s", stock: 35, unit: "Strip of 20" },
    ],
    rating: 4.4,
    ratingCount: 156,
    slug: "jain-medical-store",
    sortOrder: 3,
    storeType: "Chemist",
  },
  {
    address: "Sabzi Mandi, Hindaun City",
    area: "Sabzi Mandi",
    closesAt: "20:00",
    deliveryFee: 1500,
    description: "Mandi-fresh fruit and vegetables, picked the same morning.",
    etaMinutes: 20,
    freeDeliveryThreshold: 19900,
    latitude: 26.7312,
    longitude: 77.0358,
    minOrder: 4900,
    name: "Hindaun Fresh Sabzi Mandi",
    products: [
      { brand: "Local", category: "fruits-vegetables", mrp: 4000, name: "Tomato", price: 3200, slug: "tomato-1kg", stock: 70, unit: "1 kg", isPopular: true, tags: ["Local"] },
      { brand: "Local", category: "fruits-vegetables", mrp: 3500, name: "Onion", price: 2900, slug: "onion-1kg", stock: 90, unit: "1 kg", isPopular: true },
      { brand: "Local", category: "fruits-vegetables", mrp: 3000, name: "Potato", price: 2400, slug: "potato-1kg", stock: 85, unit: "1 kg" },
      { brand: "Local", category: "fruits-vegetables", mrp: 6000, name: "Banana", price: 5200, slug: "banana-1dozen", stock: 40, unit: "1 dozen" },
      { brand: "Local", category: "fruits-vegetables", mrp: 18000, name: "Apple Shimla", price: 15900, slug: "apple-shimla-1kg", stock: 25, unit: "1 kg", tags: ["Seasonal"] },
      { brand: "Local", category: "fruits-vegetables", mrp: 2500, name: "Coriander Leaves", price: 2000, slug: "coriander-100g", stock: 60, unit: "100 g" },
    ],
    rating: 4.3,
    ratingCount: 98,
    slug: "hindaun-fresh-sabzi-mandi",
    sortOrder: 4,
    storeType: "Fruits & Vegetables",
  },
  {
    address: "Main Market, Hindaun City",
    area: "Main Market",
    closesAt: "21:00",
    deliveryFee: 3900,
    description: "Mobile accessories, chargers, batteries and small appliances.",
    etaMinutes: 30,
    latitude: 26.734,
    longitude: 77.0374,
    minOrder: 19900,
    name: "Verma Electronics",
    products: [
      { brand: "boAt", category: "electronics", mrp: 129900, name: "boAt Rockerz 255 Pro+", price: 99900, slug: "boat-rockerz-255-pro", stock: 12, unit: "1 unit", isPopular: true, tags: ["Bestseller"] },
      { brand: "Mi", category: "electronics", mrp: 99900, name: "Mi 20000mAh Power Bank 3i", price: 84900, slug: "mi-powerbank-20000", stock: 8, unit: "1 unit" },
      { brand: "Duracell", category: "electronics", mrp: 15000, name: "Duracell AA Batteries", price: 12900, slug: "duracell-aa-4s", stock: 45, unit: "Pack of 4" },
      { brand: "Ambrane", category: "electronics", mrp: 49900, name: "Ambrane 65W Type-C Charger", price: 39900, slug: "ambrane-65w-charger", stock: 16, unit: "1 unit" },
      { brand: "Syska", category: "electronics", mrp: 22000, name: "Syska 9W LED Bulb", price: 17900, slug: "syska-led-9w", stock: 50, unit: "1 unit" },
    ],
    rating: 4.2,
    ratingCount: 74,
    slug: "verma-electronics",
    sortOrder: 5,
    storeType: "Electronics",
  },
  {
    address: "Main Bazaar, near Clock Tower, Hindaun City",
    area: "Main Bazaar",
    closesAt: "21:00",
    deliveryFee: 3500,
    description: "Everyday clothing, cosmetics and accessories for the whole family.",
    etaMinutes: 35,
    freeDeliveryThreshold: 99900,
    latitude: 26.7322,
    longitude: 77.0349,
    minOrder: 29900,
    name: "Hindaun Fashion & Beauty",
    products: [
      /* One t-shirt, four sizes. Four SKUs sharing a group: the grid shows M on
         the article's behalf, and the detail screen offers the rest. */
      { brand: "Allen Solly", category: "clothing", group: "as-polo-navy", isDefaultVariant: true, mrp: 149900, name: "Allen Solly Cotton Polo T-Shirt (Navy)", price: 99900, slug: "as-polo-navy-m", stock: 8, unit: "Medium", variantLabel: "M", variantType: "Size", isPopular: true },
      { brand: "Allen Solly", category: "clothing", group: "as-polo-navy", isDefaultVariant: false, mrp: 149900, name: "Allen Solly Cotton Polo T-Shirt (Navy)", price: 99900, slug: "as-polo-navy-s", stock: 3, unit: "Small", variantLabel: "S", variantType: "Size" },
      { brand: "Allen Solly", category: "clothing", group: "as-polo-navy", isDefaultVariant: false, mrp: 149900, name: "Allen Solly Cotton Polo T-Shirt (Navy)", price: 99900, slug: "as-polo-navy-l", stock: 0, unit: "Large", variantLabel: "L", variantType: "Size" },
      { brand: "Allen Solly", category: "clothing", group: "as-polo-navy", isDefaultVariant: false, mrp: 149900, name: "Allen Solly Cotton Polo T-Shirt (Navy)", price: 109900, slug: "as-polo-navy-xl", stock: 5, unit: "X-Large", variantLabel: "XL", variantType: "Size" },

      { brand: "Levi's", category: "clothing", mrp: 249900, name: "Levi's 511 Slim Fit Jeans", price: 189900, slug: "levis-511-32", stock: 4, unit: "Waist 32", tags: ["Bestseller"] },
      { brand: "Jockey", category: "clothing", mrp: 59900, name: "Jockey Cotton Vest (Pack of 3)", price: 49900, slug: "jockey-vest-3s", stock: 18, unit: "Pack of 3" },
      { brand: "Local", category: "clothing", mrp: 89900, name: "Cotton Kurti \u2014 Block Print", price: 69900, slug: "cotton-kurti-block", stock: 11, unit: "Free size", tags: ["Local favourite"] },

      /* One lipstick, three shades. Same pattern, different axis. */
      { brand: "Lakm\u00E9", category: "cosmetics", group: "lakme-9to5", isDefaultVariant: true, mrp: 65000, name: "Lakm\u00E9 9to5 Primer + Matte Lipstick", price: 55000, slug: "lakme-9to5-mm1", stock: 12, unit: "Ruby Rush", variantLabel: "Ruby Rush", variantType: "Shade", isPopular: true },
      { brand: "Lakm\u00E9", category: "cosmetics", group: "lakme-9to5", isDefaultVariant: false, mrp: 65000, name: "Lakm\u00E9 9to5 Primer + Matte Lipstick", price: 55000, slug: "lakme-9to5-mp3", stock: 7, unit: "Pink Post", variantLabel: "Pink Post", variantType: "Shade" },
      { brand: "Lakm\u00E9", category: "cosmetics", group: "lakme-9to5", isDefaultVariant: false, mrp: 65000, name: "Lakm\u00E9 9to5 Primer + Matte Lipstick", price: 55000, slug: "lakme-9to5-mb5", stock: 0, unit: "Burgundy Lush", variantLabel: "Burgundy Lush", variantType: "Shade" },

      { brand: "Maybelline", category: "cosmetics", mrp: 42500, name: "Maybelline Colossal Kajal", price: 36900, slug: "maybelline-kajal", stock: 30, unit: "0.35 g", isPopular: true },
      { brand: "Nivea", category: "cosmetics", mrp: 29900, name: "Nivea Soft Light Moisturiser", price: 25900, slug: "nivea-soft-100ml", stock: 22, unit: "100 ml" },
      { brand: "Mamaearth", category: "cosmetics", mrp: 39900, name: "Mamaearth Vitamin C Face Wash", price: 33900, slug: "mamaearth-vitc-100ml", stock: 16, unit: "100 ml" },

      { brand: "Pampers", category: "baby-care", mrp: 89900, name: "Pampers All Round Protection Pants (M)", price: 77900, slug: "pampers-m-56s", stock: 14, unit: "Pack of 56", isPopular: true },
      { brand: "Cerelac", category: "baby-care", mrp: 33500, name: "Nestl\u00E9 Cerelac Wheat Apple", price: 29900, slug: "cerelac-wheat-apple", stock: 20, unit: "300 g" },
      { brand: "Johnson's", category: "baby-care", mrp: 24500, name: "Johnson's Baby Shampoo", price: 21900, slug: "johnsons-shampoo-200ml", stock: 25, unit: "200 ml" },

      { brand: "Classmate", category: "stationery", mrp: 6000, name: "Classmate Ruled Notebook", price: 5200, slug: "classmate-notebook-172", stock: 60, unit: "172 pages" },
      { brand: "Reynolds", category: "stationery", mrp: 5000, name: "Reynolds Jetter Ball Pen (Pack of 5)", price: 4200, slug: "reynolds-jetter-5s", stock: 48, unit: "Pack of 5" },
      { brand: "Faber-Castell", category: "stationery", mrp: 15000, name: "Faber-Castell Colour Pencils", price: 12900, slug: "faber-pencils-24s", stock: 18, unit: "Pack of 24" },

      { brand: "Pedigree", category: "pet-supplies", mrp: 42000, name: "Pedigree Adult Dry Dog Food", price: 36900, slug: "pedigree-adult-1-2kg", stock: 12, unit: "1.2 kg" },
      { brand: "Whiskas", category: "pet-supplies", mrp: 19500, name: "Whiskas Ocean Fish Cat Food", price: 16900, slug: "whiskas-ocean-450g", stock: 15, unit: "450 g" },
    ],
    rating: 4.3,
    ratingCount: 112,
    slug: "hindaun-fashion-beauty",
    sortOrder: 7,
    storeType: "Fashion & Beauty",
  },
  {
    address: "Todabhim Road, Hindaun City",
    area: "Todabhim Road",
    closesAt: "22:30",
    deliveryFee: 2500,
    description: "Namkeen, biscuits, cold drinks and household cleaning.",
    etaMinutes: 15,
    freeDeliveryThreshold: 39900,
    latitude: 26.7265,
    longitude: 77.0318,
    minOrder: 7900,
    name: "Agarwal General Store",
    products: [
      { brand: "Haldiram's", category: "snacks-namkeen", mrp: 9000, name: "Haldiram's Aloo Bhujia", price: 8100, slug: "haldirams-aloo-bhujia-400g", stock: 40, unit: "400 g", isPopular: true },
      { brand: "Bikano", category: "snacks-namkeen", mrp: 8500, name: "Bikano Navratan Mixture", price: 7500, slug: "bikano-navratan-400g", stock: 30, unit: "400 g" },
      { brand: "Parle", category: "snacks-namkeen", mrp: 3000, name: "Parle-G Gold Biscuits", price: 2800, slug: "parle-g-gold-1kg", stock: 55, unit: "1 kg", tags: ["Bestseller"] },
      { brand: "Lay's", category: "snacks-namkeen", mrp: 2000, name: "Lay's India's Magic Masala", price: 1900, slug: "lays-magic-masala-52g", stock: 65, unit: "52 g" },
      { brand: "Tata Tea", category: "beverages", mrp: 27000, name: "Tata Tea Premium", price: 24500, slug: "tata-tea-premium-1kg", stock: 28, unit: "1 kg", isPopular: true },
      { brand: "Bru", category: "beverages", mrp: 32500, name: "Bru Instant Coffee", price: 29900, slug: "bru-instant-coffee-200g", stock: 18, unit: "200 g" },
      { brand: "Coca-Cola", category: "beverages", mrp: 9500, name: "Coca-Cola", price: 8500, slug: "coca-cola-2l", stock: 36, unit: "2 L" },
      { brand: "Surf Excel", category: "household", mrp: 23000, name: "Surf Excel Easy Wash Powder", price: 20500, slug: "surf-excel-easy-wash-2kg", stock: 24, unit: "2 kg", isPopular: true },
      { brand: "Vim", category: "household", mrp: 6000, name: "Vim Dishwash Bar", price: 5400, slug: "vim-bar-300g", stock: 50, unit: "300 g" },
      { brand: "Harpic", category: "household", mrp: 19500, name: "Harpic Power Plus Toilet Cleaner", price: 17500, slug: "harpic-power-plus-1l", stock: 22, unit: "1 L" },
      { brand: "Lizol", category: "household", mrp: 21000, name: "Lizol Floor Cleaner Citrus", price: 18900, slug: "lizol-citrus-975ml", stock: 20, unit: "975 ml" },
    ],
    rating: 4.6,
    ratingCount: 265,
    slug: "agarwal-general-store",
    sortOrder: 6,
    storeType: "Kirana",
  },
];

const seed = async () => {
  await connectDatabase();

  // --- Categories. Parents first, so a child always has one to point at. -----
  const categoryIds = new Map<string, string>();

  for (const category of categories.filter((item) => !item.parent)) {
    const record = await ProductCategoryModel.findOneAndUpdate(
      { slug: category.slug },
      {
        backgroundColor: category.backgroundColor,
        isActive: true,
        name: category.name,
        parentId: null,
        sortOrder: category.sortOrder,
      },
      { new: true, upsert: true },
    ).exec();

    categoryIds.set(category.slug, record._id.toString());
  }

  for (const category of categories.filter((item) => item.parent)) {
    const parentId = categoryIds.get(category.parent as string);

    if (!parentId) {
      logger.warn(`Skipping ${category.slug}: parent ${category.parent} not found`);
      continue;
    }

    const record = await ProductCategoryModel.findOneAndUpdate(
      { slug: category.slug },
      {
        backgroundColor: category.backgroundColor,
        isActive: true,
        name: category.name,
        parentId,
        sortOrder: category.sortOrder,
      },
      { new: true, upsert: true },
    ).exec();

    categoryIds.set(category.slug, record._id.toString());
  }

  logger.info(`Seeded ${categoryIds.size} product categories`);

  // --- Stores and their shelves ---------------------------------------------
  let productCount = 0;

  /**
   * Seed files cannot carry ObjectIds, so siblings are grouped by a readable key
   * and the real id is minted once per key here. Stable across re-runs because
   * the map is rebuilt from the same keys each time, and the upsert below
   * rewrites the field anyway.
   */
  const variantGroupIds = new Map<string, Types.ObjectId>();
  const groupIdFor = (key: string) => {
    const existing = variantGroupIds.get(key);

    if (existing) return existing;

    const minted = new Types.ObjectId();
    variantGroupIds.set(key, minted);

    return minted;
  };

  for (const store of stores) {
    const { latitude, longitude, products, ...rest } = store;

    const record = await StoreModel.findOneAndUpdate(
      { slug: store.slug },
      {
        ...rest,
        isActive: true,
        isOpen: true,
        location: { coordinates: [longitude, latitude], type: "Point" },
      },
      { new: true, upsert: true },
    ).exec();

    for (const product of products) {
      const categoryId = categoryIds.get(product.category);

      if (!categoryId) {
        logger.warn(`Skipping ${product.slug}: category ${product.category} not found`);
        continue;
      }

      await ProductModel.findOneAndUpdate(
        { slug: product.slug, storeId: record._id },
        {
          brand: product.brand,
          categoryId,
          isAvailable: true,
          isPopular: product.isPopular ?? false,
          maxPerOrder: 10,
          mrp: product.mrp,
          name: product.name,
          price: product.price,
          stock: product.stock,
          storeId: record._id,
          storeName: record.name,
          tags: product.tags ?? [],
          unit: product.unit,
          ...(product.group
            ? {
                isDefaultVariant: product.isDefaultVariant ?? false,
                variantGroupId: groupIdFor(product.group),
                variantLabel: product.variantLabel,
                variantType: product.variantType,
              }
            : { isDefaultVariant: true }),
          requiresPrescription: product.requiresPrescription ?? false,
        },
        { new: true, upsert: true },
      ).exec();

      productCount += 1;
    }

    logger.info(`Seeded ${record.name} with ${products.length} products`);
  }

  logger.info(`Done: ${stores.length} stores, ${productCount} products`);

  await disconnectDatabase();
};

seed().catch(async (error) => {
  logger.error(error, "Failed to seed stores");
  await disconnectDatabase();
  process.exit(1);
});
