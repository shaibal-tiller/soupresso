// Expense type for every bazar item: cost_of_goods (needed to make the product), operational (only spent when the shop opens), overhead (costs even when it is closed). Item overrides win over the item's category default. Each entry is [type, sub-category]; the sub-category is used by the Excel analysis.
// (A .js module, not .json, so Node ESM scripts, tests and Next.js can all import it without extra syntax.)
export default {
  "types": [
    "cost_of_goods",
    "operational",
    "overhead"
  ],
  "categoryDefaults": {
    "Meat & Egg": [
      "cost_of_goods",
      "Ingredients – Meat & Egg"
    ],
    "Vegetables": [
      "cost_of_goods",
      "Ingredients – Veg & Herbs"
    ],
    "Herbs & Leaves": [
      "cost_of_goods",
      "Ingredients – Veg & Herbs"
    ],
    "Raw Spices": [
      "cost_of_goods",
      "Ingredients – Spices, Sauces & Essentials"
    ],
    "Processed Spices & Sauces": [
      "cost_of_goods",
      "Ingredients – Spices, Sauces & Essentials"
    ],
    "Cooking Essentials": [
      "cost_of_goods",
      "Ingredients – Spices, Sauces & Essentials"
    ],
    "Serving, Seating & Packaging": [
      "operational",
      "Packaging & serving supplies"
    ],
    "Cleaning Supplies": [
      "operational",
      "Cleaning & misc"
    ],
    "Shop": [
      "operational",
      "Equipment, tools & repairs"
    ],
    "Staff & Home": [
      "overhead",
      "Staff pay, meals & housing"
    ]
  },
  "itemOverrides": {
    "Gas Cylinder Refill - Shop/Cart": [
      "cost_of_goods",
      "Cooking gas"
    ],
    "Soup Parcel Bowl": [
      "cost_of_goods",
      "Product containers"
    ],
    "Meat Box": [
      "cost_of_goods",
      "Product containers"
    ],
    "Parcel Box": [
      "cost_of_goods",
      "Product containers"
    ],
    "Paper Pack / Thonga - Large": [
      "cost_of_goods",
      "Product containers"
    ],
    "Paper Pack / Thonga - Small": [
      "cost_of_goods",
      "Product containers"
    ],
    "Sauce Cup": [
      "cost_of_goods",
      "Product containers"
    ],
    "Peeler": [
      "operational",
      "Equipment, tools & repairs"
    ],
    "Mixing Bati": [
      "operational",
      "Equipment, tools & repairs"
    ],
    "Auto Fare": [
      "operational",
      "Transport"
    ],
    "Extra Travel / Bazar Trip": [
      "operational",
      "Transport"
    ],
    "Bulk Transport / Van Hire": [
      "operational",
      "Transport"
    ],
    "Miscellaneous": [
      "operational",
      "Cleaning & misc"
    ],
    "Shop Rent": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Shop Electric Bill": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Shop Utility": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Shop Water Bill": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Shop Cleaning": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Chef House Rent": [
      "overhead",
      "Shop rent & utilities"
    ],
    "Home Utility": [
      "overhead",
      "Shop rent & utilities"
    ]
  }
};
