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

const categories: SeedCategory[] = [
  { backgroundColor: "#FFE7D3", file: "offer.png", name: "Offers", slug: "offers", sortOrder: 1 },
  { backgroundColor: "#FFEBD1", file: "pizza.png", name: "Pizza", slug: "pizza", sortOrder: 2 },
  { backgroundColor: "#FFF1CC", file: "burger.png", name: "Burgers", slug: "burgers", sortOrder: 3 },
  { backgroundColor: "#FFE1E6", file: "sushi.png", name: "Sushi", slug: "sushi", sortOrder: 4 },
  {
    backgroundColor: "#FBE2EF",
    file: "desserts.png",
    name: "Desserts",
    slug: "desserts",
    sortOrder: 5,
  },
  { backgroundColor: "#FFE3D6", file: "jollof.png", name: "Jollof", slug: "jollof", sortOrder: 6 },
  { backgroundColor: "#DFF3E4", file: "healthy.png", name: "Healthy", slug: "healthy", sortOrder: 7 },
  { backgroundColor: "#DDEEFB", file: "drinks.png", name: "Drinks", slug: "drinks", sortOrder: 8 },
];

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
