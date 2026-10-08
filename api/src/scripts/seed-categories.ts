import path from "node:path";

import { isCloudinaryConfigured, uploadImage } from "../config/cloudinary.config";
import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { CategoryModel } from "../models/category.model";
import { logger } from "../utils/logger";

/**
 * Seeds the home-screen categories from api/assets/category-imgs.
 *
 * With Cloudinary keys set, each image is uploaded to `chowly/categories` and the
 * secure URL is stored. Without them the categories are still created so the app
 * and admin have real records — re-run this script after adding the keys to fill
 * in the images.
 *
 * Run with: npm run seed:categories
 */

const IMAGE_DIR = path.resolve(__dirname, "../../assets/category-imgs");
const CLOUDINARY_FOLDER = "chowly/categories";

type SeedCategory = {
  name: string;
  slug: string;
  file: string;
  backgroundColor: string;
  sortOrder: number;
};

/**
 * The food browse strip, ordered roughly by how a Hindaun customer shops:
 * offers, then full meals, then the things people actually order at 9pm.
 *
 * `file` is only read when Cloudinary is configured AND the matching image
 * exists in api/assets/category-imgs; a missing file just leaves the category
 * without a picture rather than failing the seed. The admin can add, rename,
 * delete and reorder all of these afterwards — this is a starting point, not
 * a fixed list.
 */
const CATALOGUE: [name: string, slug: string, background: string][] = [
  ["Offers", "offers", "#FFE7D3"],
  // Full meals
  ["Thali", "thali", "#FFF1CC"],
  ["North Indian", "north-indian", "#FFE8CF"],
  ["South Indian", "south-indian", "#E9F0D9"],
  ["Biryani", "biryani", "#FDE8D0"],
  ["Chinese", "chinese", "#FFE1E6"],
  ["Tandoori", "tandoori", "#FBDFD2"],
  ["Curry", "curry", "#FDEBD2"],
  // Fast food
  ["Pizza", "pizza", "#FFEBD1"],
  ["Burgers", "burgers", "#FFF0D6"],
  ["Rolls", "rolls", "#FFEFD9"],
  ["Momos", "momos", "#EFEAF6"],
  ["Sandwich", "sandwich", "#FDF3DA"],
  ["Pasta", "pasta", "#FFECE2"],
  ["Noodles", "noodles", "#FFF2E0"],
  ["Fried Chicken", "fried-chicken", "#FBE3D5"],
  ["Kebab", "kebab", "#F6DED4"],
  // Breakfast and street food
  ["Breakfast", "breakfast", "#FFF6DC"],
  ["Paratha", "paratha", "#FDEFD6"],
  ["Dosa", "dosa", "#F0F3DB"],
  ["Chaat", "chaat", "#FFE6D9"],
  ["Snacks", "snacks", "#FFE3CF"],
  ["Paneer", "paneer", "#F4F1E4"],
  // Sweet
  ["Sweets", "sweets", "#FDE2EC"],
  ["Ice Cream", "ice-cream", "#E4F1FA"],
  ["Cakes", "cakes", "#FBE4EE"],
  ["Desserts", "desserts", "#FDE9F0"],
  // Drinks
  ["Beverages", "beverages", "#DDEEFB"],
  ["Tea & Coffee", "tea-coffee", "#EDE4DA"],
  ["Juices", "juices", "#E8F4DC"],
  ["Shakes", "shakes", "#F2E8F7"],
  // Other
  ["Healthy", "healthy", "#DFF3E4"],
  ["Combos", "combos", "#FFEDD8"],
];

const categories: SeedCategory[] = CATALOGUE.map(([name, slug, backgroundColor], index) => ({
  backgroundColor,
  file: `${slug}.png`,
  name,
  slug,
  sortOrder: index + 1,
}));

const seed = async () => {
  await connectDatabase();

  const uploadsEnabled = isCloudinaryConfigured();

  if (!uploadsEnabled) {
    logger.warn(
      "Cloudinary keys missing — seeding categories without images. Add the keys and re-run to upload.",
    );
  }

  for (const category of categories) {
    let imageUrl = "";
    let imagePublicId: string | undefined;

    if (uploadsEnabled) {
      const uploaded = await uploadImage(path.join(IMAGE_DIR, category.file), {
        folder: CLOUDINARY_FOLDER,
        publicId: category.slug,
      });

      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    // Upsert on slug so re-running is safe and never duplicates a category.
    await CategoryModel.findOneAndUpdate(
      { slug: category.slug },
      {
        $set: {
          backgroundColor: category.backgroundColor,
          isActive: true,
          name: category.name,
          sortOrder: category.sortOrder,
          ...(uploadsEnabled ? { imagePublicId, imageUrl } : {}),
        },
        $setOnInsert: { slug: category.slug },
      },
      { returnDocument: "after", upsert: true },
    ).exec();

    logger.info("Seeded category", { image: uploadsEnabled ? "uploaded" : "skipped", slug: category.slug });
  }

  logger.info("Category seed complete", { count: categories.length });

  await disconnectDatabase();
};

void seed().catch(async (error: unknown) => {
  logger.error("Category seed failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
