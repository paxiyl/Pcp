/**
 * Restaurant fixtures used until the catalogue endpoints land (M1). Categories
 * already come from the API; names, cuisines, ratings, prep times, fees and the
 * banner offer here are still representative and must be replaced by real
 * Cloudinary-backed restaurant, dish and banner records before release.
 */

export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  ratingCount: number;
  prepTime: string;
  deliveryFee: string;
  initial: string;
};

export const popularNearYou: Restaurant[] = [
  {
    cuisines: ["Italian", "Pasta"],
    deliveryFee: "$1.99 delivery",
    id: "bella-italia",
    initial: "B",
    name: "Bella Italia",
    prepTime: "25–35 min",
    rating: 4.6,
    ratingCount: 812,
  },
  {
    cuisines: ["Burgers", "American"],
    deliveryFee: "Free delivery",
    id: "grill-house",
    initial: "G",
    name: "Grill House",
    prepTime: "20–30 min",
    rating: 4.7,
    ratingCount: 642,
  },
];

export const topPicks: Restaurant[] = [
  {
    cuisines: ["Sushi", "Japanese"],
    deliveryFee: "$2.49 delivery",
    id: "sushi-daily",
    initial: "S",
    name: "Sushi Daily",
    prepTime: "20–30 min",
    rating: 4.6,
    ratingCount: 318,
  },
  {
    cuisines: ["Healthy", "Bowls"],
    deliveryFee: "$1.99 delivery",
    id: "poke-fresh",
    initial: "P",
    name: "Poké Fresh",
    prepTime: "25–35 min",
    rating: 4.7,
    ratingCount: 209,
  },
  {
    cuisines: ["Desserts", "Bakery"],
    deliveryFee: "$1.49 delivery",
    id: "sweet-spot",
    initial: "W",
    name: "Sweet Spot",
    prepTime: "15–25 min",
    rating: 4.5,
    ratingCount: 154,
  },
];

export const popularCuisines = ["Pizza", "Jollof", "Burgers", "Sushi", "Healthy", "Desserts"];
