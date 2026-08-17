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
const TEAL: PurchaseVisual = { emoji: "🥤", badgeClass: "bg-brand-teal-soft text-brand-teal", accentClass: "bg-brand-teal" };

const NAME_MATCHES: { pattern: RegExp; visual: PurchaseVisual }[] = [
  // Vegetables
  { pattern: /spring onion/i, visual: { ...GREEN, emoji: "🧅" } },
  { pattern: /cabbage/i, visual: { ...GREEN, emoji: "🥬" } },
  { pattern: /capsicum|bell pepper/i, visual: { ...GREEN, emoji: "🫑" } },
  { pattern: /tomato/i, visual: { ...GREEN, emoji: "🍅" } },
  { pattern: /cucumber/i, visual: { ...GREEN, emoji: "🥒" } },
  { pattern: /carrot/i, visual: { ...GREEN, emoji: "🥕" } },
  { pattern: /potato/i, visual: { ...GREEN, emoji: "🥔" } },
  { pattern: /eggplant|brinjal/i, visual: { ...GREEN, emoji: "🍆" } },
  { pattern: /lemon/i, visual: { ...GREEN, emoji: "🍋" } },
  // Processed spices & sauces
  { pattern: /paste/i, visual: { ...MAROON, emoji: "🥫" } },
  { pattern: /soy sauce/i, visual: { ...MAROON, emoji: "🍶" } },
  { pattern: /chili sauce|ketchup/i, visual: { ...MAROON, emoji: "🥫" } },
  { pattern: /vinegar/i, visual: { ...MAROON, emoji: "🍶" } },
  { pattern: /curry powder|chili powder/i, visual: { ...MAROON, emoji: "🌶️" } },
  { pattern: /(spice|masala)/i, visual: { ...MAROON, emoji: "🧂" } },
  // Raw spices & aromatics
  { pattern: /onion/i, visual: { ...GREEN, emoji: "🧅" } },
  { pattern: /ginger/i, visual: { ...GREEN, emoji: "🫚" } },
  { pattern: /garlic/i, visual: { ...GREEN, emoji: "🧄" } },
  { pattern: /turmeric/i, visual: { ...AMBER, emoji: "🟡" } },
  { pattern: /cumin/i, visual: { ...AMBER, emoji: "🌰" } },
  { pattern: /coriander/i, visual: { ...GREEN, emoji: "🌿" } },
  { pattern: /bay leaf/i, visual: { ...GREEN, emoji: "🍃" } },
  { pattern: /cardamom/i, visual: { ...AMBER, emoji: "🌰" } },
  { pattern: /cinnamon/i, visual: { ...AMBER, emoji: "🟤" } },
  { pattern: /chili|pepper/i, visual: { ...GREEN, emoji: "🌶️" } },
  { pattern: /salt/i, visual: { ...MAROON, emoji: "🧂" } },
  // Cooking essentials
  { pattern: /chicken/i, visual: { ...AMBER, emoji: "🐔" } },
  { pattern: /\bmilk\b/i, visual: { ...TEAL, emoji: "🥛" } },
  { pattern: /butter/i, visual: { ...AMBER, emoji: "🧈" } },
  { pattern: /\brice\b/i, visual: { ...AMBER, emoji: "🍚" } },
  { pattern: /flour|maida/i, visual: { ...AMBER, emoji: "🌾" } },
  { pattern: /oil/i, visual: { ...AMBER, emoji: "🛢️" } },
  { pattern: /egg/i, visual: { ...AMBER, emoji: "🥚" } },
  { pattern: /mushroom/i, visual: { ...GREEN, emoji: "🍄" } },
  { pattern: /sugar/i, visual: { ...AMBER, emoji: "🍬" } },
  { pattern: /cold drink|cola|soda/i, visual: { ...TEAL, emoji: "🥤" } },
  { pattern: /cheese/i, visual: { ...AMBER, emoji: "🧀" } },
  { pattern: /tortilla|chips/i, visual: { ...AMBER, emoji: "🌽" } },
  { pattern: /(wrapper|sheet|dough)/i, visual: { ...MAROON, emoji: "🥟" } },
  // Packaging & disposables
  { pattern: /soup bowl/i, visual: { ...MAROON, emoji: "🥣" } },
  { pattern: /(parcel|meat) box/i, visual: { ...MAROON, emoji: "📦" } },
  { pattern: /tray/i, visual: { ...MAROON, emoji: "🍽️" } },
  { pattern: /(poly|plastic) bag/i, visual: { ...MAROON, emoji: "🛍️" } },
  { pattern: /foil/i, visual: { ...MAROON, emoji: "🧻" } },
  { pattern: /(plate|spoon|cutlery)/i, visual: { ...MAROON, emoji: "🍴" } },
  { pattern: /(napkin|tissue)/i, visual: { ...MAROON, emoji: "🧻" } },
  // Cooking ware & kitchen equipment
  { pattern: /karai|wok/i, visual: { ...MAROON, emoji: "🥘" } },
  { pattern: /frying pan|\bpan\b/i, visual: { ...MAROON, emoji: "🍳" } },
  { pattern: /cooking pot|dekchi/i, visual: { ...MAROON, emoji: "🍲" } },
  { pattern: /gas cylinder/i, visual: { ...MAROON, emoji: "🛢️" } },
  { pattern: /gas stove|burner/i, visual: { ...MAROON, emoji: "🔥" } },
  { pattern: /knife/i, visual: { ...MAROON, emoji: "🔪" } },
  { pattern: /cutting board/i, visual: { ...MAROON, emoji: "🪵" } },
  { pattern: /serving plate/i, visual: { ...MAROON, emoji: "🍽️" } },
  { pattern: /ladle|spatula/i, visual: { ...MAROON, emoji: "🥄" } },
  // Furniture
  { pattern: /chair/i, visual: { ...MAROON, emoji: "🪑" } },
  { pattern: /table/i, visual: { ...MAROON, emoji: "🛋️" } },
  { pattern: /mora|stool/i, visual: { ...MAROON, emoji: "🪑" } },
  { pattern: /moi|ladder/i, visual: { ...MAROON, emoji: "🪜" } },
  { pattern: /shelf|rack/i, visual: { ...MAROON, emoji: "🗄️" } },
  // Electronics & appliances
  { pattern: /fridge/i, visual: { ...TEAL, emoji: "🧊" } },
  { pattern: /light|bulb/i, visual: { ...TEAL, emoji: "💡" } },
  { pattern: /camera|cctv/i, visual: { ...TEAL, emoji: "📷" } },
  { pattern: /router/i, visual: { ...TEAL, emoji: "📶" } },
  { pattern: /blender/i, visual: { ...TEAL, emoji: "🌀" } },
  { pattern: /grinder/i, visual: { ...TEAL, emoji: "⚙️" } },
  { pattern: /beater|mixer/i, visual: { ...TEAL, emoji: "🥣" } },
  { pattern: /\bfan\b/i, visual: { ...TEAL, emoji: "🌬️" } },
  // Cleaning & maintenance
  { pattern: /detergent|dish soap/i, visual: { ...AMBER, emoji: "🧴" } },
  { pattern: /sponge|scrubber/i, visual: { ...AMBER, emoji: "🧽" } },
  { pattern: /broom/i, visual: { ...AMBER, emoji: "🧹" } },
  { pattern: /trash bag/i, visual: { ...AMBER, emoji: "🗑️" } },
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
