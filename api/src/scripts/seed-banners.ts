import path from "node:path";

import { isCloudinaryConfigured, uploadImage } from "../config/cloudinary.config";
import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { BannerModel } from "../models/banner.model";
import { logger } from "../utils/logger";

/**
 * Seeds the promotional banners from the artwork the mobile app ships with, so
 * the admin screen manages the same three offers the home carousel shows.
 *
 * Run with: npm run seed:banners
 */

const IMAGE_DIR = path.resolve(__dirname, "../../../mobile/assets/images/app-imgs");
const CLOUDINARY_FOLDER = "chowly/banners";

type SeedBanner = {
  key: string;
  title: string;
  subtitle: string;
  categorySlug: string;
  file: string;
  sortOrder: number;
};

const banners: SeedBanner[] = [
  {
    categorySlug: "burgers",
    file: "banner-1-full.png",
    key: "comfort-favourites",
    sortOrder: 1,
    subtitle: "Order now",
    title: "20% off selected comfort favourites",
  },
  {
    categorySlug: "offers",
    file: "banner-2.png",
    key: "free-delivery-weekend",
    sortOrder: 2,
    subtitle: "On orders over $15",
    title: "Free delivery this weekend",
  },
  {
    categorySlug: "sushi",
    file: "banner-3.png",
    key: "five-off",
    sortOrder: 3,
    subtitle: "Use code CHOWLY5, minimum $20",
    title: "$5 off your next order",
  },
];

const seed = async () => {
  await connectDatabase();

  const uploadsEnabled = isCloudinaryConfigured();

  if (!uploadsEnabled) {
    logger.warn(
      "Cloudinary keys missing — seeding banners without images. Add the keys and re-run to upload.",
    );
  }

  for (const banner of banners) {
    let imageUrl = "";
    let imagePublicId: string | undefined;

    if (uploadsEnabled) {
      const uploaded = await uploadImage(path.join(IMAGE_DIR, banner.file), {
        folder: CLOUDINARY_FOLDER,
        publicId: banner.key,
      });

      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    // Upsert on the artwork id, which is stable even when the copy is edited.
    await BannerModel.findOneAndUpdate(
      { imagePublicId: `${CLOUDINARY_FOLDER}/${banner.key}` },
      {
        $set: {
          categorySlug: banner.categorySlug,
          isActive: true,
          sortOrder: banner.sortOrder,
          subtitle: banner.subtitle,
          title: banner.title,
          ...(uploadsEnabled ? { imagePublicId, imageUrl } : {}),
        },
      },
      { returnDocument: "after", upsert: true },
    ).exec();

    logger.info("Seeded banner", { image: uploadsEnabled ? "uploaded" : "skipped", title: banner.title });
  }

  logger.info("Banner seed complete", { count: banners.length });

  await disconnectDatabase();
};

void seed();
