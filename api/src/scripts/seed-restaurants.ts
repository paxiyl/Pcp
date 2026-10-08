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
  isPopular?: boolean;
  calories?: number;
  allergens?: string[];
  optionGroups?: SeedOptionGroup[];
  /** File in api/assets, uploaded alongside the restaurant cover. */
  file?: string;
};

type SeedRestaurant = {
  name: string;
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
    address: "3 Hoe Street, London E17",
    location: { lat: 51.5836, lng: -0.0197 },
    categorySlugs: ["pizza", "offers"],
    closesAt: "22:30",
    cuisines: ["Italian", "Pizza", "Pasta"],
    deliveryFee: 490,
    description: "Wood-fired pizza and fresh pasta, made to order by the Rossi family.",
    dishes: [
      {
        description: "Slow-cooked pancetta, egg yolk and pecorino",
        file: "spaghetti.png",
        isPopular: true,
        name: "Spaghetti Carbonara",
        price: 649,
        section: "Popular",
      },
      {
        allergens: ["Milk", "Gluten"],
        calories: 680,
        description:
          "San Marzano tomato sauce, fior di latte mozzarella, fresh basil and extra virgin olive oil.",
        isPopular: true,
        name: "Classic Margherita",
        optionGroups: [
          {
            name: "Choose size",
            options: [
              { isDefault: true, name: 'Regular (10")', priceDelta: 0 },
              { name: 'Large (12")', priceDelta: 120 },
              { name: 'Extra Large (14")', priceDelta: 220 },
            ],
            required: true,
            type: "single",
          },
          {
            name: "Add extras",
            options: [
              { name: "Extra Mozzarella", priceDelta: 100 },
              { name: "Rocket", priceDelta: 80 },
              { name: "Cherry Tomatoes", priceDelta: 80 },
            ],
            required: false,
            type: "multiple",
          },
          {
            name: "Remove",
            options: [{ name: "No Cheese" }, { name: "No Basil" }],
            required: false,
            type: "multiple",
          },
        ],
        price: 429,
        section: "Popular",
      },
      {
        description: "Chilli, garlic and tomato with a slow simmer",
        name: "Penne Arrabbiata",
        price: 549,
        section: "Mains",
      },
      { description: "With garlic butter", name: "Garlic Bread", price: 349, section: "Sides" },
      { description: "330ml", name: "Coca-Cola", price: 150, section: "Drinks" },
    ],
    file: "spaghetti.png",
    minOrder: 800,
    name: "Bella Italia",
    prepTimeMaxMinutes: 35,
    prepTimeMinMinutes: 25,
    rating: 4.6,
    ratingCount: 812,
    slug: "bella-italia",
    sortOrder: 1,
  },
  {
    address: "18 Blackhorse Lane, London E17",
    location: { lat: 51.5871, lng: -0.041 },
    categorySlugs: ["burgers", "offers"],
    closesAt: "23:00",
    cuisines: ["Burgers", "American"],
    deliveryFee: 490,
    description: "Smashed patties, brioche buns and proper chips.",
    dishes: [
      {
        allergens: ["Milk", "Gluten", "Sesame"],
        calories: 940,
        description: "Double patty, cheddar, pickles and house sauce in a brioche bun.",
        file: "stacked-cheeseburger.png",
        isPopular: true,
        name: "Double Cheeseburger",
        optionGroups: [
          {
            name: "Choose your side",
            options: [
              { isDefault: true, name: "Skin-on fries", priceDelta: 0 },
              { name: "Sweet potato fries", priceDelta: 150 },
              { name: "House salad", priceDelta: 100 },
            ],
            required: true,
            type: "single",
          },
          {
            name: "Add extras",
            options: [
              { name: "Extra patty", priceDelta: 250 },
              { name: "Bacon", priceDelta: 150 },
              { name: "Jalapeños", priceDelta: 70 },
            ],
            required: false,
            type: "multiple",
          },
          {
            name: "Remove",
            options: [{ name: "No pickles" }, { name: "No sauce" }],
            required: false,
            type: "multiple",
          },
        ],
        price: 899,
        section: "Popular",
      },
      {
        description: "Buttermilk chicken, slaw, chipotle mayo",
        isPopular: true,
        name: "Crispy Chicken Burger",
        price: 799,
        section: "Popular",
      },
      { description: "Skin-on, rosemary salt", name: "Loaded Fries", price: 399, section: "Sides" },
      { description: "Vanilla or chocolate", name: "Milkshake", price: 449, section: "Drinks" },
    ],
    file: "stacked-cheeseburger.png",
    minOrder: 1000,
    name: "Grill House",
    prepTimeMaxMinutes: 30,
    prepTimeMinMinutes: 20,
    rating: 4.7,
    ratingCount: 642,
    slug: "grill-house",
    sortOrder: 2,
  },
  {
    address: "44 Orford Road, London E17",
    location: { lat: 51.5862, lng: -0.0139 },
    categorySlugs: ["sushi"],
    closesAt: "21:30",
    cuisines: ["Sushi", "Japanese"],
    deliveryFee: 490,
    description: "Hand-rolled sushi prepared fresh through the day.",
    dishes: [
      {
        description: "Eight pieces, salmon and avocado",
        file: "sushi-rolls.png",
        isPopular: true,
        name: "Salmon Avocado Roll",
        price: 799,
        section: "Popular",
      },
      {
        description: "Twelve pieces, chef's selection",
        isPopular: true,
        name: "Mixed Nigiri Platter",
        price: 1299,
        section: "Mains",
      },
      { description: "Steamed, sea salt", name: "Edamame", price: 349, section: "Sides" },
      { description: "Cold, 500ml", name: "Green Tea", price: 250, section: "Drinks" },
    ],
    file: "sushi-rolls.png",
    minOrder: 1200,
    name: "Sushi Daily",
    prepTimeMaxMinutes: 30,
    prepTimeMinMinutes: 20,
    rating: 4.6,
    ratingCount: 318,
    slug: "sushi-daily",
    sortOrder: 3,
  },
  {
    address: "7 Wood Street, London E17",
    location: { lat: 51.5878, lng: -0.006 },
    categorySlugs: ["healthy"],
    closesAt: "20:00",
    cuisines: ["Healthy", "Bowls"],
    deliveryFee: 490,
    description: "Bright poké bowls built on sushi rice or greens.",
    dishes: [
      {
        description: "Ahi tuna, edamame, mango, sesame dressing",
        file: "colorful-poké.png",
        isPopular: true,
        name: "Rainbow Poké Bowl",
        price: 1049,
        section: "Popular",
      },
      {
        description: "Marinated tofu, pickled ginger, crispy onions",
        name: "Teriyaki Tofu Bowl",
        price: 899,
        section: "Mains",
      },
      { description: "Cucumber, sesame, chilli", name: "Sunomono Salad", price: 399, section: "Sides" },
      { description: "Pressed, 330ml", name: "Cold Brew", price: 320, section: "Drinks" },
    ],
    file: "colorful-poké.png",
    minOrder: 900,
    name: "Poké Fresh",
    prepTimeMaxMinutes: 35,
    prepTimeMinMinutes: 25,
    rating: 4.7,
    ratingCount: 209,
    slug: "poke-fresh",
    sortOrder: 4,
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
          categories: seedRestaurant.categorySlugs
            .map((slug) => categoryIdBySlug.get(slug))
            .filter(Boolean),
          closesAt: seedRestaurant.closesAt,
          cuisines: seedRestaurant.cuisines,
          deliveryFee: seedRestaurant.deliveryFee,
          description: seedRestaurant.description,
          isActive: true,
          isOpen: true,
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
            optionGroups: seedDish.optionGroups ?? [],
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
