// Fine-grained shopping groups for the Quick Purchase tile picker — purely a
// display/filter concern, layered on top of the underlying EntryCategory
// (which still decides which ledger account an item posts to). Classifying
// by name means new item names slot into the right bucket automatically;
// extending the taxonomy is just adding a pattern here, never a migration.

export type PurchaseGroupKey =
  | "RAW_SPICES"
  | "PROCESSED_SPICES"
  | "VEGETABLES"
  | "COOKING_ESSENTIALS"
  | "PACKAGING"
  | "COOKING_WARE"
  | "FURNITURE"
  | "ELECTRONICS"
  | "CLEANING"
  | "OTHER";

export const PURCHASE_GROUP_LABELS: Record<PurchaseGroupKey, string> = {
  RAW_SPICES: "Raw Spices",
  PROCESSED_SPICES: "Processed Spices & Sauces",
  VEGETABLES: "Vegetables",
  COOKING_ESSENTIALS: "Cooking Items",
  PACKAGING: "Packaging & Supplies",
  COOKING_WARE: "Cooking Wares",
  FURNITURE: "Furniture",
  ELECTRONICS: "Electronics & Appliances",
  CLEANING: "Cleaning & Maintenance",
  OTHER: "Other",
};

// Display order for filter chips and grouped sections.
export const PURCHASE_GROUP_ORDER: PurchaseGroupKey[] = [
  "RAW_SPICES",
  "PROCESSED_SPICES",
  "VEGETABLES",
  "COOKING_ESSENTIALS",
  "PACKAGING",
  "COOKING_WARE",
  "FURNITURE",
  "ELECTRONICS",
  "CLEANING",
  "OTHER",
];

// Ordered most-specific-first: the first pattern that matches the item name wins.
const NAME_GROUP_MATCHES: { pattern: RegExp; key: PurchaseGroupKey }[] = [
  // Vegetables (checked before the generic "onion" spice pattern below)
  { pattern: /spring onion|cabbage|capsicum|bell pepper|tomato|cucumber|carrot|potato|eggplant|brinjal|lemon/i, key: "VEGETABLES" },
  // Processed spices & sauces (pastes, powders, condiments)
  { pattern: /paste|soy sauce|chili sauce|ketchup|vinegar|curry powder|chili powder|spices|masala/i, key: "PROCESSED_SPICES" },
  // Raw spices & aromatics
  { pattern: /onion|ginger|garlic|turmeric|cumin|coriander|bay leaf|cardamom|cinnamon|clove|dried chili|green chili/i, key: "RAW_SPICES" },
  // Packaging & disposables
  { pattern: /soup bowl|parcel box|meat box|nachos tray|poly bag|foil|plate.*spoon|napkin|tissue/i, key: "PACKAGING" },
  // Cooking ware & kitchen equipment
  { pattern: /karai|wok|frying pan|\bpan\b|cooking pot|dekchi|gas cylinder|gas stove|burner|\bknife\b|cutting board|serving plate|ladle|spatula/i, key: "COOKING_WARE" },
  // Furniture
  { pattern: /\bchair\b|\btable\b|\bmora\b|\bstool\b|\bmoi\b|ladder|shelf|\brack\b|\bbench\b/i, key: "FURNITURE" },
  // Electronics & appliances
  { pattern: /fridge|light|bulb|camera|cctv|router|blender|grinder|beater|mixer|\bfan\b/i, key: "ELECTRONICS" },
  // Cleaning & maintenance
  { pattern: /detergent|dish soap|sponge|scrubber|broom|trash bag|bleach/i, key: "CLEANING" },
  // Everyday cooking ingredients (checked last among ingredients — broadest net)
  { pattern: /chicken|\begg\b|cheese|\bmilk\b|butter|mushroom|cooking oil|\boil\b|sugar|\bsalt\b|\brice\b|flour|maida|tortilla|chips|cold drink|cola|soda|momo|wonton|wrapper|sheet|dough/i, key: "COOKING_ESSENTIALS" },
];

// Fallback bucket when no name pattern matches, keyed by the item's underlying
// accounting category so a completely novel item still lands somewhere sane.
const CATEGORY_FALLBACK_GROUP: Record<string, PurchaseGroupKey> = {
  RAW_MATERIAL: "COOKING_ESSENTIALS",
  PACKAGING_SUPPLIES: "PACKAGING",
  CLEANING_MAINTENANCE: "CLEANING",
  ASSET_PURCHASE: "COOKING_WARE",
  OTHER_EXPENSE: "OTHER",
};

export function getPurchaseGroupKey(name: string, category: string): PurchaseGroupKey {
  const match = NAME_GROUP_MATCHES.find((m) => m.pattern.test(name));
  if (match) return match.key;
  return CATEGORY_FALLBACK_GROUP[category] ?? "OTHER";
}
