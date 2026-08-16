// Maps a menu item to an emoji + a brand color treatment, first by keyword
// match on the name (so "Chicken Wonton" and "Wonton" both resolve), then by
// category. Class strings are literal (not built via template interpolation)
// so Tailwind's build-time scanner picks them up.

export interface MenuVisual {
  emoji: string;
  badgeClass: string; // icon badge background + text color
  accentClass: string; // top accent bar / border color
}

const AMBER: MenuVisual = { emoji: "🍲", badgeClass: "bg-brand-amber-soft text-brand-amber-deep", accentClass: "bg-brand-amber" };
const MAROON: MenuVisual = { emoji: "🍱", badgeClass: "bg-brand-maroon-soft text-brand-maroon", accentClass: "bg-brand-maroon" };
const GREEN: MenuVisual = { emoji: "🥟", badgeClass: "bg-brand-green-soft text-brand-green", accentClass: "bg-brand-green" };
const TEAL: MenuVisual = { emoji: "🥤", badgeClass: "bg-brand-teal-soft text-brand-teal", accentClass: "bg-brand-teal" };

const NAME_MATCHES: { pattern: RegExp; visual: MenuVisual }[] = [
  { pattern: /soup/i, visual: { ...AMBER, emoji: "🍲" } },
  { pattern: /momo/i, visual: { ...GREEN, emoji: "🥟" } },
  { pattern: /wonton/i, visual: { ...GREEN, emoji: "🥟" } },
  { pattern: /taquito/i, visual: { ...MAROON, emoji: "🌯" } },
  { pattern: /spring roll/i, visual: { ...GREEN, emoji: "🥠" } },
  { pattern: /(fries|fry)/i, visual: { ...AMBER, emoji: "🍟" } },
  { pattern: /meat box/i, visual: { ...MAROON, emoji: "🍱" } },
  { pattern: /nachos/i, visual: { ...AMBER, emoji: "🧀" } },
  { pattern: /(coffee|espresso)/i, visual: { ...MAROON, emoji: "☕" } },
  { pattern: /(tea|chai)/i, visual: { ...GREEN, emoji: "🍵" } },
  { pattern: /(juice|drink|shake|cola|soda)/i, visual: { ...TEAL, emoji: "🥤" } },
];

const CATEGORY_FALLBACK: Record<string, MenuVisual> = {
  SOUP: { ...AMBER, emoji: "🍲" },
  MAIN: { ...MAROON, emoji: "🍱" },
  SNACK: { ...GREEN, emoji: "🥟" },
  DRINK: { ...TEAL, emoji: "🥤" },
  OTHER: { ...MAROON, emoji: "🍽️" },
};

export function getMenuVisual(name: string, category: string): MenuVisual {
  const match = NAME_MATCHES.find((m) => m.pattern.test(name));
  if (match) return match.visual;
  return CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.OTHER;
}
