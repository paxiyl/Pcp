import path from "node:path";

import { isCloudinaryConfigured, uploadImage } from "../config/cloudinary.config";
import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { CategoryModel } from "../models/category.model";
import { DishModel } from "../models/dish.model";
import { RestaurantModel } from "../models/restaurant.model";
import { logger } from "../utils/logger";

/**
 * Seeds restaurants and their menus. Cover photos come from api/assets and are
 * uploaded to Cloudinary when keys are set; without keys the records are still
 * created and the app falls back to its initial tile.
 *
 * Prices are in cents. Re-running upserts on slug, so it never duplicates.
 *
 * Run with: npm run seed:restaurants
 */

const ASSET_DIR = path.resolve(__dirname, "../../assets");
const CLOUDINARY_FOLDER = "chowly/restaurants";

type SeedOption = { name: string; priceDelta?: number; isDefault?: boolean };

type SeedOptionGroup = {
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: SeedOption[];
};

type SeedDish = {
  name: string;
  description: string;
  price: number;
  section: string;
  /** Required, with no default: a wrong veg mark is not recoverable. */
  isVeg: boolean;
  isPopular?: boolean;
  calories?: number;
  allergens?: string[];
  optionGroups?: SeedOptionGroup[];
  /** File in api/assets, uploaded alongside the restaurant cover. */
  file?: string;
  /**
   * A preset tile key, used instead of a photograph.
   *
   * The seed used to point at image files in api/assets that are not in the
   * repository, so every seeded dish came out with no picture whenever image
   * hosting was unconfigured — which it is by default. A preset needs no
   * hosting and no licence, and is honestly "no photo yet" rather than a
   * broken grey square.
   */
  imagePreset?: string;
};

type SeedRestaurant = {
  name: string;
  /** Shown as a badge, and what the veg-only filter reads on a kitchen. */
  isPureVeg?: boolean;
  slug: string;
  description: string;
  file?: string;
  cuisines: string[];
  categorySlugs: string[];
  rating: number;
  ratingCount: number;
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold?: number;
  address: string;
  /** Approximate street position, used by the order tracking map. */
  location: { lat: number; lng: number };
  closesAt: string;
  sortOrder: number;
  dishes: SeedDish[];
};

const restaurants: SeedRestaurant[] = [
  {
    address: "Bazaar Road, near the bus stand, Hindaun City",
    categorySlugs: ["tandoori", "north-indian", "offers"],
    closesAt: "23:00",
    cuisines: ["North Indian", "Tandoori"],
    deliveryFee: 2000,
    description: "Tandoori roti, butter chicken and dal makhani from the clay oven.",
    dishes: [
      {
        description: "Boneless chicken in a tomato and butter gravy",
        imagePreset: "thali",
        isPopular: true,
        isVeg: false,
        name: "Butter Chicken",
        optionGroups: [
          {
            name: "Portion",
            options: [
              { isDefault: true, name: "Half", priceDelta: 0 },
              { name: "Full", priceDelta: 11000 },
            ],
            required: true,
            type: "single",
          },
        ],
        price: 22000,
        section: "Main course",
      },
      {
        description: "Black lentils slow-cooked overnight",
        imagePreset: "thali",
        isPopular: true,
        isVeg: true,
        name: "Dal Makhani",
        price: 16000,
        section: "Main course",
      },
      {
        description: "Cottage cheese marinated in yoghurt and spices",
        imagePreset: "tandoori",
        isVeg: true,
        name: "Paneer Tikka",
        price: 20000,
        section: "Starters",
      },
      {
        description: "Straight from the tandoor, brushed with butter",
        imagePreset: "paratha",
        isVeg: true,
        name: "Tandoori Roti",
        price: 1500,
        section: "Breads",
      },
    ],
    freeDeliveryThreshold: 30000,
    location: { lat: 26.7324, lng: 77.0352 },
    minOrder: 10000,
    name: "Hindaun Tandoori",
    prepTimeMaxMinutes: 40,
    prepTimeMinMinutes: 25,
    rating: 4.4,
    ratingCount: 186,
    slug: "hindaun-tandoori",
    sortOrder: 1,
  },
  {
    address: "Station Road, opposite the petrol pump, Hindaun City",
    categorySlugs: ["thali", "north-indian"],
    closesAt: "22:00",
    cuisines: ["Thali", "North Indian"],
    deliveryFee: 1500,
    description: "Pure veg bhojnalaya. Unlimited roti with every thali.",
    dishes: [
      {
        description: "Two sabzi, dal, rice, four roti, salad and papad",
        imagePreset: "thali",
        isPopular: true,
        isVeg: true,
        name: "Special Thali",
        price: 12000,
        section: "Thali",
      },
      {
        description: "Dal, rice, three roti and one sabzi",
        imagePreset: "thali",
        isVeg: true,
        name: "Simple Thali",
        price: 8000,
        section: "Thali",
      },
      {
        description: "Potato and cauliflower, dry masala",
        imagePreset: "thali",
        isVeg: true,
        name: "Aloo Gobhi",
        price: 9000,
        section: "Sabzi",
      },
      {
        description: "Set curd, served cold",
        imagePreset: "dairy",
        isVeg: true,
        name: "Dahi",
        price: 3000,
        section: "Sides",
      },
    ],
    isPureVeg: true,
    location: { lat: 26.7291, lng: 77.0318 },
    minOrder: 8000,
    name: "Shri Ganesh Bhojnalaya",
    prepTimeMaxMinutes: 30,
    prepTimeMinMinutes: 20,
    rating: 4.6,
    ratingCount: 342,
    slug: "shri-ganesh-bhojnalaya",
    sortOrder: 2,
  },
  {
    address: "Karauli Road, Hindaun City",
    categorySlugs: ["biryani", "offers"],
    closesAt: "23:30",
    cuisines: ["Biryani", "Mughlai"],
    deliveryFee: 2500,
    description: "Dum biryani cooked in sealed handis, counted by the plate.",
    dishes: [
      {
        description: "Long-grain rice layered with marinated chicken",
        imagePreset: "biryani",
        isPopular: true,
        isVeg: false,
        name: "Chicken Dum Biryani",
        optionGroups: [
          {
            name: "Plate",
            options: [
              { isDefault: true, name: "Single", priceDelta: 0 },
              { name: "Family (serves 3)", priceDelta: 32000 },
            ],
            required: true,
            type: "single",
          },
        ],
        price: 18000,
        section: "Biryani",
      },
      {
        description: "Seasonal vegetables and paneer, same dum method",
        imagePreset: "biryani",
        isVeg: true,
        name: "Veg Dum Biryani",
        price: 14000,
        section: "Biryani",
      },
      {
        description: "Whipped curd with onion, cucumber and roasted cumin",
        imagePreset: "dairy",
        isVeg: true,
        name: "Raita",
        price: 4000,
        section: "Sides",
      },
    ],
    freeDeliveryThreshold: 40000,
    location: { lat: 26.7357, lng: 77.0401 },
    minOrder: 12000,
    name: "Biryani House Hindaun",
    prepTimeMaxMinutes: 45,
    prepTimeMinMinutes: 30,
    rating: 4.3,
    ratingCount: 211,
    slug: "biryani-house-hindaun",
    sortOrder: 3,
  },
  {
    address: "Main Market, near the clock tower, Hindaun City",
    categorySlugs: ["chinese", "momos", "noodles"],
    closesAt: "22:30",
    cuisines: ["Chinese", "Street food"],
    deliveryFee: 1500,
    description: "Chowmein off the tawa and steamed momos with red chutney.",
    dishes: [
      {
        description: "Hakka noodles tossed with cabbage, carrot and capsicum",
        imagePreset: "noodles",
        isPopular: true,
        isVeg: true,
        name: "Veg Chowmein",
        optionGroups: [
          {
            name: "Make it",
            options: [
              { isDefault: true, name: "Normal", priceDelta: 0 },
              { name: "Extra spicy", priceDelta: 0 },
              { name: "Schezwan", priceDelta: 2000 },
            ],
            required: false,
            type: "single",
          },
        ],
        price: 7000,
        section: "Noodles",
      },
      {
        description: "Eight pieces, steamed, with red chutney",
        imagePreset: "momos",
        isPopular: true,
        isVeg: true,
        name: "Veg Momos",
        price: 6000,
        section: "Momos",
      },
      {
        description: "Paneer tossed in a sweet and sharp chilli sauce",
        imagePreset: "chinese",
        isVeg: true,
        name: "Chilli Paneer",
        price: 13000,
        section: "Starters",
      },
    ],
    location: { lat: 26.7310, lng: 77.0339 },
    minOrder: 6000,
    name: "Chowmein Corner",
    prepTimeMaxMinutes: 25,
    prepTimeMinMinutes: 15,
    rating: 4.2,
    ratingCount: 158,
    slug: "chowmein-corner",
    sortOrder: 4,
  },
  {
    address: "Gandhi Chowk, Hindaun City",
    categorySlugs: ["pizza", "burgers", "sandwich"],
    closesAt: "23:00",
    cuisines: ["Pizza", "Fast food"],
    deliveryFee: 2000,
    description: "Hand-stretched pizza, burgers and grilled sandwiches.",
    dishes: [
      {
        description: "Mozzarella and tomato, nothing else",
        imagePreset: "pizza",
        isPopular: true,
        isVeg: true,
        name: "Margherita Pizza",
        optionGroups: [
          {
            name: "Size",
            options: [
              { isDefault: true, name: "Regular (7 inch)", priceDelta: 0 },
              { name: "Medium (10 inch)", priceDelta: 9000 },
              { name: "Large (12 inch)", priceDelta: 17000 },
            ],
            required: true,
            type: "single",
          },
          {
            name: "Add toppings",
            options: [
              { name: "Extra cheese", priceDelta: 4000 },
              { name: "Paneer", priceDelta: 5000 },
              { name: "Olives", priceDelta: 3000 },
            ],
            required: false,
            type: "multiple",
          },
        ],
        price: 14000,
        section: "Pizza",
      },
      {
        description: "Paneer tikka, onion and capsicum",
        imagePreset: "pizza",
        isVeg: true,
        name: "Paneer Tikka Pizza",
        price: 19000,
        section: "Pizza",
      },
      {
        description: "Crumb-fried patty, lettuce and mint mayo",
        imagePreset: "burger",
        isVeg: true,
        name: "Veg Burger",
        price: 6000,
        section: "Burgers",
      },
    ],
    location: { lat: 26.7336, lng: 77.0367 },
    minOrder: 10000,
    name: "Pizza Point Hindaun",
    prepTimeMaxMinutes: 35,
    prepTimeMinMinutes: 20,
    rating: 4.1,
    ratingCount: 97,
    slug: "pizza-point-hindaun",
    sortOrder: 5,
  },
  {
    address: "Sabzi Mandi Road, Hindaun City",
    categorySlugs: ["sweets", "snacks", "offers"],
    closesAt: "21:30",
    cuisines: ["Sweets", "Snacks"],
    deliveryFee: 1500,
    description: "Mithai made fresh each morning, and samosas fried to order.",
    dishes: [
      {
        description: "Two pieces, potato and pea filling, with chutney",
        imagePreset: "samosa",
        isPopular: true,
        isVeg: true,
        name: "Samosa",
        price: 3000,
        section: "Namkeen",
      },
      {
        description: "Spiced moong dal filling, served with aloo sabzi",
        imagePreset: "samosa",
        isVeg: true,
        name: "Kachori",
        price: 3000,
        section: "Namkeen",
      },
      {
        description: "Half kilo, soaked in cardamom syrup",
        imagePreset: "mithai",
        isPopular: true,
        isVeg: true,
        name: "Gulab Jamun",
        price: 16000,
        section: "Mithai",
      },
      {
        description: "Half kilo, fried fresh and still warm",
        imagePreset: "mithai",
        isVeg: true,
        name: "Jalebi",
        price: 12000,
        section: "Mithai",
      },
    ],
    isPureVeg: true,
    location: { lat: 26.7302, lng: 77.0328 },
    minOrder: 5000,
    name: "Sharma Sweets & Namkeen",
    prepTimeMaxMinutes: 25,
    prepTimeMinMinutes: 15,
    rating: 4.5,
    ratingCount: 404,
    slug: "sharma-sweets-namkeen",
    sortOrder: 6,
  },
];

const seed = async () => {
  await connectDatabase();

  const uploadsEnabled = isCloudinaryConfigured();

  if (!uploadsEnabled) {
    logger.warn("Cloudinary keys missing — seeding without images. Add keys and re-run to upload.");
  }

  // Upload each asset once, even when several records share it.
  const uploads = new Map<string, { url: string; publicId: string }>();

  /**
   * Kitchens filed under no category never appear in the app's category strip,
   * and the old `.filter(Boolean)` swallowed that silently — so running
   * `seed:restaurants` without `seed:categories` first produced six kitchens
   * that looked seeded and were unreachable by browsing.
   */
  const resolveCategories = (seedRestaurant: SeedRestaurant) => {
    const resolved = seedRestaurant.categorySlugs
      .map((slug) => ({ id: categoryIdBySlug.get(slug), slug }))
      .filter((entry) => {
        if (!entry.id) {
          logger.warn("Category not found — run seed:categories first", {
            restaurant: seedRestaurant.slug,
            slug: entry.slug,
          });
        }

        return Boolean(entry.id);
      });

    if (resolved.length === 0) {
      logger.warn("Kitchen filed under NO category; it will not appear in the strip", {
        restaurant: seedRestaurant.slug,
      });
    }

    return resolved.map((entry) => entry.id);
  };

  const uploadOnce = async (file: string) => {
    if (!uploadsEnabled) return undefined;

    const cached = uploads.get(file);
    if (cached) return cached;

    const uploaded = await uploadImage(path.join(ASSET_DIR, file), {
      folder: CLOUDINARY_FOLDER,
      publicId: path.parse(file).name,
    });

    uploads.set(file, uploaded);

    return uploaded;
  };

  const categories = await CategoryModel.find().select("_id slug").exec();
  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category._id]));

  for (const seedRestaurant of restaurants) {
    const cover = seedRestaurant.file ? await uploadOnce(seedRestaurant.file) : undefined;

    const restaurant = await RestaurantModel.findOneAndUpdate(
      { slug: seedRestaurant.slug },
      {
        $set: {
          address: seedRestaurant.address,
          // Stored as GeoJSON [longitude, latitude] to match the 2dsphere index.
          location: {
            coordinates: [seedRestaurant.location.lng, seedRestaurant.location.lat],
            type: "Point",
          },
          categories: resolveCategories(seedRestaurant),
          closesAt: seedRestaurant.closesAt,
          cuisines: seedRestaurant.cuisines,
          deliveryFee: seedRestaurant.deliveryFee,
          description: seedRestaurant.description,
          isActive: true,
          isOpen: true,
          isPureVeg: seedRestaurant.isPureVeg ?? false,
          freeDeliveryThreshold: seedRestaurant.freeDeliveryThreshold,
          minOrder: seedRestaurant.minOrder,
          name: seedRestaurant.name,
          prepTimeMaxMinutes: seedRestaurant.prepTimeMaxMinutes,
          prepTimeMinMinutes: seedRestaurant.prepTimeMinMinutes,
          rating: seedRestaurant.rating,
          ratingCount: seedRestaurant.ratingCount,
          sortOrder: seedRestaurant.sortOrder,
          ...(cover ? { imagePublicId: cover.publicId, imageUrl: cover.url } : {}),
        },
        $setOnInsert: { slug: seedRestaurant.slug },
      },
      { returnDocument: "after", upsert: true },
    ).exec();

    if (!restaurant) continue;

    let sortOrder = 0;

    for (const seedDish of seedRestaurant.dishes) {
      const dishImage = seedDish.file ? await uploadOnce(seedDish.file) : undefined;

      await DishModel.findOneAndUpdate(
        { name: seedDish.name, restaurantId: restaurant._id },
        {
          $set: {
            allergens: seedDish.allergens ?? [],
            calories: seedDish.calories,
            description: seedDish.description,
            isAvailable: true,
            isPopular: seedDish.isPopular ?? false,
            isVeg: seedDish.isVeg,
            optionGroups: seedDish.optionGroups ?? [],
            ...(seedDish.imagePreset ? { imagePreset: seedDish.imagePreset } : {}),
            price: seedDish.price,
            section: seedDish.section,
            sortOrder: sortOrder++,
            ...(dishImage ? { imagePublicId: dishImage.publicId, imageUrl: dishImage.url } : {}),
          },
          $setOnInsert: { name: seedDish.name, restaurantId: restaurant._id },
        },
        { returnDocument: "after", upsert: true },
      ).exec();
    }

    logger.info("Seeded restaurant", {
      dishes: seedRestaurant.dishes.length,
      image: cover ? "uploaded" : "skipped",
      slug: seedRestaurant.slug,
    });
  }

  logger.info("Restaurant seed complete", { count: restaurants.length });

  await disconnectDatabase();
};

void seed().catch(async (error: unknown) => {
  logger.error("Restaurant seed failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
