// Maps a purchase item to an emoji + brand color treatment, first by keyword
// match on the name, then by category. Mirrors menu-icon.ts. Class strings
// are literal (not built via template interpolation) so Tailwind's
// build-time scanner picks them up.

export interface PurchaseVisual {
  emoji: string;
  badgeClass: string;
  accentClass: string;
}

const AMBER: PurchaseVisual = { emoji: "🛒", badgeClass: "bg-brand-amber-soft text-brand-amber-deep", accentClass: "bg-brand-amber" };
const MAROON: PurchaseVisual = { emoji: "📦", badgeClass: "bg-brand-maroon-soft text-brand-maroon", accentClass: "bg-brand-maroon" };
const GREEN: PurchaseVisual = { emoji: "🥬", badgeClass: "bg-brand-green-soft text-brand-green", accentClass: "bg-brand-green" };

const NAME_MATCHES: { pattern: RegExp; visual: PurchaseVisual }[] = [
  { pattern: /chicken/i, visual: { ...AMBER, emoji: "🐔" } },
  { pattern: /onion/i, visual: { ...GREEN, emoji: "🧅" } },
  { pattern: /garlic|ginger/i, visual: { ...GREEN, emoji: "🧄" } },
  { pattern: /oil/i, visual: { ...AMBER, emoji: "🛢️" } },
  { pattern: /egg/i, visual: { ...AMBER, emoji: "🥚" } },
  { pattern: /mushroom/i, visual: { ...GREEN, emoji: "🍄" } },
  { pattern: /chili|pepper/i, visual: { ...GREEN, emoji: "🌶️" } },
  { pattern: /(spice|masala)/i, visual: { ...MAROON, emoji: "🧂" } },
  { pattern: /salt/i, visual: { ...MAROON, emoji: "🧂" } },
  { pattern: /lemon/i, visual: { ...GREEN, emoji: "🍋" } },
  { pattern: /cheese/i, visual: { ...AMBER, emoji: "🧀" } },
  { pattern: /tortilla|chips/i, visual: { ...AMBER, emoji: "🌽" } },
  { pattern: /(wrapper|sheet|dough)/i, visual: { ...MAROON, emoji: "🥟" } },
  { pattern: /soup bowl/i, visual: { ...MAROON, emoji: "🥣" } },
  { pattern: /(parcel|meat) box/i, visual: { ...MAROON, emoji: "📦" } },
  { pattern: /tray/i, visual: { ...MAROON, emoji: "🍽️" } },
  { pattern: /(poly|plastic) bag/i, visual: { ...MAROON, emoji: "🛍️" } },
  { pattern: /foil/i, visual: { ...MAROON, emoji: "🧻" } },
  { pattern: /(plate|spoon|cutlery)/i, visual: { ...MAROON, emoji: "🍴" } },
  { pattern: /(napkin|tissue)/i, visual: { ...MAROON, emoji: "🧻" } },
];

const CATEGORY_FALLBACK: Record<string, PurchaseVisual> = {
  RAW_MATERIAL: { ...GREEN, emoji: "🥬" },
  PACKAGING_SUPPLIES: { ...MAROON, emoji: "📦" },
  CLEANING_MAINTENANCE: { ...AMBER, emoji: "🧹" },
  ASSET_PURCHASE: { ...MAROON, emoji: "🛠️" },
  OTHER_EXPENSE: { ...AMBER, emoji: "🛒" },
};

export function getPurchaseVisual(name: string, category: string): PurchaseVisual {
  const match = NAME_MATCHES.find((m) => m.pattern.test(name));
  if (match) return match.visual;
  return CATEGORY_FALLBACK[category] ?? AMBER;
}
