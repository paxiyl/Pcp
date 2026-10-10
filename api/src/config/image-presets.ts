/**
 * Stand-in images for a catalogue item with no photograph.
 *
 * Deliberately NOT hosted pictures. Three reasons: image hosting is optional in
 * this deployment and often not configured, stock food photography is a
 * licensing problem nobody wants, and a photo of someone else's pizza is a small
 * lie to the customer. A tinted tile with a glyph on it is honestly "no photo
 * yet" while still looking deliberate in a grid.
 *
 * The glyph is an emoji rather than an icon name because it has to render
 * identically in React Native, in the browser backoffice and in anything built
 * later, with no icon library to keep in step across three codebases.
 *
 * Keys are stored on products and dishes, so they are permanent: rename a label
 * freely, never a key.
 */

export const PRESET_CATALOGUES = ["grocery", "food"] as const;

export type PresetCatalogue = (typeof PRESET_CATALOGUES)[number];

export type ImagePreset = {
  key: string;
  label: string;
  glyph: string;
  /** Background ramp, light to dark, as the clients draw it. */
  colors: [string, string];
  catalogue: PresetCatalogue;
};

const GROCERY: ImagePreset[] = [
  { catalogue: "grocery", colors: ["#FEF3C7", "#FDE68A"], glyph: "🌾", key: "atta-rice", label: "Atta & rice" },
  { catalogue: "grocery", colors: ["#FEE2E2", "#FECACA"], glyph: "🫘", key: "pulses", label: "Dal & pulses" },
  { catalogue: "grocery", colors: ["#DBEAFE", "#BFDBFE"], glyph: "🥛", key: "dairy", label: "Milk & dairy" },
  { catalogue: "grocery", colors: ["#DCFCE7", "#BBF7D0"], glyph: "🥬", key: "fruit-veg", label: "Fruit & veg" },
  { catalogue: "grocery", colors: ["#FEF9C3", "#FEF08A"], glyph: "🫗", key: "oil-ghee", label: "Oil & ghee" },
  { catalogue: "grocery", colors: ["#FFEDD5", "#FED7AA"], glyph: "🌶️", key: "spices", label: "Spices & masala" },
  { catalogue: "grocery", colors: ["#FAE8FF", "#F5D0FE"], glyph: "🍿", key: "snacks", label: "Namkeen & snacks" },
  { catalogue: "grocery", colors: ["#FFE4E6", "#FECDD3"], glyph: "🍪", key: "biscuits", label: "Biscuits" },
  { catalogue: "grocery", colors: ["#CFFAFE", "#A5F3FC"], glyph: "🥤", key: "cold-drinks", label: "Cold drinks" },
  { catalogue: "grocery", colors: ["#F3E8D7", "#E7D3B5"], glyph: "🍵", key: "tea-coffee", label: "Tea & coffee" },
  { catalogue: "grocery", colors: ["#E0F2FE", "#BAE6FD"], glyph: "🧼", key: "cleaning", label: "Cleaning" },
  { catalogue: "grocery", colors: ["#F5F3FF", "#DDD6FE"], glyph: "🧴", key: "personal-care", label: "Personal care" },
  { catalogue: "grocery", colors: ["#FFF1F2", "#FFE4E6"], glyph: "🍼", key: "baby", label: "Baby care" },
  { catalogue: "grocery", colors: ["#FEF3C7", "#FDE68A"], glyph: "🥚", key: "eggs-meat", label: "Eggs & meat" },
  { catalogue: "grocery", colors: ["#FDF2D0", "#FBE7A8"], glyph: "🍞", key: "bakery", label: "Bread & bakery" },
  { catalogue: "grocery", colors: ["#FFEDD5", "#FDBA74"], glyph: "🍯", key: "sweets-packaged", label: "Mithai & sweets" },
  { catalogue: "grocery", colors: ["#F7F3E8", "#E8DCC4"], glyph: "🥜", key: "dry-fruits", label: "Dry fruits" },
  { catalogue: "grocery", colors: ["#EEF2FF", "#E0E7FF"], glyph: "📒", key: "stationery", label: "Stationery" },
];

const FOOD: ImagePreset[] = [
  { catalogue: "food", colors: ["#FFE4D6", "#FDBA8C"], glyph: "🍕", key: "pizza", label: "Pizza" },
  { catalogue: "food", colors: ["#FEF3C7", "#FCD34D"], glyph: "🍔", key: "burger", label: "Burger" },
  { catalogue: "food", colors: ["#FFEDD5", "#FDBA74"], glyph: "🍛", key: "thali", label: "Thali" },
  { catalogue: "food", colors: ["#FEF9C3", "#FDE047"], glyph: "🍚", key: "biryani", label: "Biryani & rice" },
  { catalogue: "food", colors: ["#FEE2E2", "#FCA5A5"], glyph: "🍜", key: "chinese", label: "Chinese" },
  { catalogue: "food", colors: ["#DCFCE7", "#86EFAC"], glyph: "🥘", key: "south-indian", label: "South Indian" },
  { catalogue: "food", colors: ["#FDE68A", "#FBBF24"], glyph: "🫓", key: "paratha", label: "Paratha & roti" },
  { catalogue: "food", colors: ["#FFE4E6", "#FDA4AF"], glyph: "🥗", key: "chaat", label: "Chaat" },
  { catalogue: "food", colors: ["#FEF3C7", "#FCD34D"], glyph: "🥟", key: "samosa", label: "Samosa & pakora" },
  { catalogue: "food", colors: ["#F1F5F9", "#CBD5E1"], glyph: "🥠", key: "momos", label: "Momos" },
  { catalogue: "food", colors: ["#FFEDD5", "#FB923C"], glyph: "🌯", key: "rolls", label: "Rolls & wraps" },
  { catalogue: "food", colors: ["#FDF2F8", "#F9A8D4"], glyph: "🍮", key: "mithai", label: "Mithai" },
  { catalogue: "food", colors: ["#E0F2FE", "#7DD3FC"], glyph: "🍨", key: "ice-cream", label: "Ice cream" },
  { catalogue: "food", colors: ["#FCE7F3", "#F9A8D4"], glyph: "🥤", key: "shakes", label: "Shakes & juice" },
  { catalogue: "food", colors: ["#F3E8D7", "#D6B98C"], glyph: "☕", key: "chai", label: "Chai & coffee" },
  { catalogue: "food", colors: ["#ECFCCB", "#BEF264"], glyph: "🥪", key: "sandwich", label: "Sandwich" },
  { catalogue: "food", colors: ["#FFE4D6", "#FDBA8C"], glyph: "🍝", key: "noodles", label: "Noodles & pasta" },
  { catalogue: "food", colors: ["#FEF2F2", "#FCA5A5"], glyph: "🍲", key: "pav-bhaji", label: "Pav bhaji" },
];

export const IMAGE_PRESETS: ImagePreset[] = [...GROCERY, ...FOOD];

const BY_KEY = new Map(IMAGE_PRESETS.map((preset) => [preset.key, preset]));

export const PRESET_KEYS = IMAGE_PRESETS.map((preset) => preset.key);

export const isPresetKey = (value: unknown): value is string =>
  typeof value === "string" && BY_KEY.has(value);

export const findPreset = (key?: string): ImagePreset | undefined =>
  key ? BY_KEY.get(key) : undefined;
