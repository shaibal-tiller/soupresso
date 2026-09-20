# Bazar Item Catalog — Redesign Plan

**Why this exists:** across the 38 days you just backfilled (349 item lines), 43 different
free-text "Other" names showed up — several of them the *same* real item typed
differently each time (`Onthon sheet` / `Onthon Sheet`, `Barlie` / `Barley`, `Sausage (4packet)` / `Sausage (8packet)` / `Sausage (5Packet)`, `Thonga Paper Pack` / `Thonga Paper pack` / `Thonga Paper Pack Large`...). None of that is wrong data, it just can't be
grouped or reported on. This plan turns those into a proper picklist, organized around how
the shop actually runs (from your description), so future entries reach for a dropdown
instead of typing "Other."

**How to use this doc:**

1. Skim the category tables below — this is the *proposed* full catalog (existing items +
   new ones).
2. Section "Reconciliation Map" at the bottom maps every free-text name we found in your
   export to the new catalog entry it should become — use it when we reopen
   `daily-backfill.html` to fix names/units.
3. Nothing here touches the database yet. Once you've reviewed/adjusted this list, it
   becomes the source of truth for the `bazar_items` catalog when we fix the app.

Table columns mirror the actual schema: **Item** (English) · **Bengali/local name** ·
**Unit** (default) · **Unit options** (if more than one) · **Notes**.

---

## 1. Meat & Egg

The big change here: **"Chicken" stops being one lump item.** You buy boneless, drumstick,
wings, and breast separately and by weight — the catalog should say so, so a month from now
you can actually see "we used 40kg of breast vs 12kg of wings" instead of one Chicken
number.

| Item                   | Bengali                          | Unit   | Options    | Notes                                             |
| ---------------------- | -------------------------------- | ------ | ---------- | ------------------------------------------------- |
| Chicken – Breast      | মুরগির বুকের মাংস | kg     |            |                                                   |
| Chicken – Boneless    | মুরগির বোনলেস        | kg     |            |                                                   |
| Chicken – Drumstick   | মুরগির রান              | kg     |            |                                                   |
| Chicken – Wings       | মুরগির ডানা            | kg     |            |                                                   |
| Chicken – Whole/Mixed | মুরগি (মিশ্র)          | kg     |            | Only when a purchase genuinely isn't split by cut |
| Egg                    | ডিম                           | dozen  | pc, case30 | unchanged                                         |
| Sausage                | সসেজ                         | packet | pc         | seen as 4/5/8-packet purchases                    |
| Fish                   | মাছ                           | kg     |            | seen once (Aug 29)                                |

## 2. Vegetables

Unchanged from the existing catalog (Onion, Potato, Ginger, Garlic, Green Chili, Carrot,
Cabbage, Tomato, Cucumber, Eggplant, Lemon, Spring Onion, Capsicum) — these already covered
everything used. No additions needed here.

## 3. Herbs & Leaves *(new category, split out of Vegetables)*

You treat these differently from root vegetables (bought in small 100–500g bundles, wilt
fast, used almost daily) — worth its own group so the picker isn't one giant Vegetables
list.

| Item                       | Bengali               | Unit | Options          | Notes                                        |
| -------------------------- | --------------------- | ---- | ---------------- | -------------------------------------------- |
| Coriander Leaves (Parsley) | ধনে পাতা       | 250g | 100g, 250g, 500g | existing item, moved here                    |
| Mint Leaf (Pudina)         | পুদিনা পাতা | 250g | 100g, 250g, 500g | new — appeared 5 times as "Other"           |
| Thai Leaves                | থাই পাতা       | 250g | 100g, 250g, 500g | existing item, moved here                    |
| Thai Ginger                | থাই আদা         | 250g | 100g, 250g       | new — different rhizome from regular Ginger |

## 4. Raw Spices

Adding the specific items from your list that the current catalog is missing.

| Item                      | Bengali                          | Unit | Options        | Notes                                        |
| ------------------------- | -------------------------------- | ---- | -------------- | -------------------------------------------- |
| Dried Chili               | শুকনা মরিচ              | 100g | 100g, 250g, kg | existing                                     |
| Turmeric (Holud)          | হলুদ                         | 100g | 100g, 250g, kg | existing                                     |
| Cumin (Jira)              | জিরা                         | 100g | 100g, 250g, kg | existing                                     |
| Coriander Seed            | ধনে                           | 100g | 100g, 250g, kg | existing — whole seed                       |
| Coriander Powder (Dhonia) | ধনে গুঁড়া              | 100g | 100g, 250g     | new — distinct from Coriander Leaves (herb) |
| Bay Leaf                  | তেজপাতা                   | pack | 100g, 250g     | existing                                     |
| Cardamom                  | এলাচ                         | 100g | 100g, 250g, kg | existing                                     |
| Cinnamon                  | দারুচিনি                 | 100g | 100g, 250g, kg | existing                                     |
| Chili Powder              | মরিচের গুঁড়া        | 100g | 100g, 250g, kg | existing                                     |
| Garlic Powder             | রসুন গুঁড়া            | 100g | 100g, 250g     | new                                          |
| Ginger Powder             | আদা গুঁড়া              | 100g | 100g, 250g     | new                                          |
| Garam Masala              | গরম মসলা                  | 100g | 100g, 250g, kg | existing                                     |
| Curry Powder              | কারি পাউডার            | 100g | 100g, 250g, kg | existing                                     |
| Kabab Masala              | কাবাব মসলা              | 100g | 100g, 250g, kg | existing                                     |
| Chaat Masala              | চাট মসলা                  | 100g | 100g, 250g, kg | existing                                     |
| Black Pepper (Gol Morich) | গোল মরিচ                  | 100g | 100g, 250g     | new — whole                                 |
| Black Pepper Powder       | গোল মরিচের গুঁড়া | 100g | 100g, 250g     | new — ground                                |
| Bit Lobon (Black Salt)    | বিট লবণ                    | kg   |                | new — seen as "Bit Salt (1kg)"              |
| Yeast                     | ইস্ট                         | 100g | 100g, 250g     | new                                          |
| Barley (Barlie)           | বার্লি                     | kg   |                | new — seen 3× as "Barlie"/"Barley"         |

## 5. Processed Spices & Sauces

| Item                | Bengali                    | Unit  | Options | Notes            |
| ------------------- | -------------------------- | ----- | ------- | ---------------- |
| Ginger-Garlic Paste | আদা-রসুন পেস্ট | kg    |         | existing         |
| Soy Sauce           | সয়া সস              | litre |         | existing         |
| Chili Sauce         | চিলি সস              | litre |         | existing         |
| Vinegar             | ভিনেগার             | litre |         | existing         |
| Naga Achar (Pickle) | নাগা আচার          | kg    | pc      | new — seen once |

## 6. Cooking Essentials

No changes needed — Cooking Oil, Salt, Sugar, Milk, Butter, Rice, AP Flour (Moyda), Cheese,
Corn Flour already cover it. Oil stays as one item with a plain litre quantity (e.g. `4.5`)
rather than separate 1L/2L/4.5L/5L items — that split was deliberately removed from the app
before (see `schema.sql` comment) since the pack size isn't worth tracking separately from
the litres actually used.

*Home vs. shop oil split:* the app doesn't track which location oil goes to, and adding a
duplicate "Cooking Oil (Home)" item would break totals elsewhere. If you want that split
later, it's better as a note on the line ("2L → home") than a second catalog item.

## 7. Serving & Seating *(new category)*

Reusable, low-frequency purchases for how food is served and customers sit — distinct from
disposable Packaging below.

| Item          | Bengali                   | Unit | Options | Notes                                              |
| ------------- | ------------------------- | ---- | ------- | -------------------------------------------------- |
| Serving Bowl  | সার্ভিং বাটি   | pc   |         | for soup, dine-in                                  |
| Serving Spoon | সার্ভিং চামচ   | pc   |         | soup spoon, reusable                               |
| Mixing Bati   | মিক্সিং বাটি   | pc   |         | seen as "Steel Bati" — for mixing nachos/meat box |
| Serving Tray  | সার্ভিং ট্রে   | pc   |         |                                                    |
| Serving Plate | সার্ভিং প্লেট | pc   |         |                                                    |
| Plastic Stool | প্লাস্টিক টুল | pc   |         | customer seating                                   |

## 8. Packaging (disposables)

Expanded to match your actual parcel/dine-in flow: soup → lidded plastic bowl, fries →
paper pack ("thonga") lined with foil, meat box → ready-made box, carry → poly bag, plus
cold-drink and water-bottle consumables.

| Item                             | Bengali                            | Unit   | Options | Notes                                                                                       |
| -------------------------------- | ---------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------- |
| Soup Parcel Bowl (500ml, w/ lid) | স্যুপ পার্সেল বাটি | pc     |         | recurring, existing "Soup Bowl" renamed for clarity                                         |
| One-Time Plastic Spoon           | ওয়ান টাইম চামচ       | pc     | pack    | goes with every soup parcel                                                                 |
| Meat Box (ready-made)            | মিট বক্স                    | pc     |         | new — distinct from generic Parcel Box                                                     |
| Parcel Box (general)             | পার্সেল বক্স            | pc     |         | existing                                                                                    |
| Paper Pack / Thonga – Small     | থোংগা (ছোট)                | kg     |         | new — for fried items                                                                      |
| Paper Pack / Thonga – Large     | থোংগা (বড়)                | kg     |         | new                                                                                         |
| Foil Paper                       | ফয়েল পেপার              | roll   |         | existing — lines tray/plate under fries                                                    |
| Poly Bag – Small (Carry)        | পলি ব্যাগ (ছোট)         | kg     |         | replaces generic "Poly Bag"                                                                 |
| Poly Bag – Large (Carry)        | পলি ব্যাগ (বড়)         | kg     |         |                                                                                             |
| Garbage Bag                      | ময়লার ব্যাগ            | kg     | pack    | new — kept separate from carry bags                                                        |
| Napkin / Tissue                  | ন্যাপকিন/টিস্যু      | pack   |         | existing — given to customers on request                                                   |
| Water Bottle – 500ml            | পানির বোতল ৫০০মিলি | pc     |         | new                                                                                         |
| Water Bottle – 250ml            | পানির বোতল ২৫০মিলি | pc     |         | new                                                                                         |
| Sauce Cup                        | সস কাপ                        | pc     | pack    | new                                                                                         |
| Straw & Cap                      | স্ট্র ও ক্যাপ           | pc     | pack    | new                                                                                         |
| Ice                              | বরফ                             | kg     | block   | new                                                                                         |
| Ice Carrying/Delivery            | বরফ বহন খরচ               | trip   |         | new — small delivery fee, keep separate from Ice cost                                      |
| Onthon Sheet                     | ওনথন শীট                    | packet |         | new — wrapper for the "Chicken Onthon" menu item; was the single most common "Other" (8×) |

## 9. Staff & Home

Split the old catch-all "Shop Utility" into the three things you actually named
(electric, water, cleaning), and added the repair/hardware side explicitly.

| Item                      | Bengali                                | Unit   | Options | Notes                                                                          |
| ------------------------- | -------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------ |
| Salary                    | বেতন                               | person |         | existing, lump                                                                 |
| Salary Advance            | বেতন অগ্রিম                  | person |         | existing, lump — partial or full advance                                      |
| Chef Breakfast            | বাবুর্চির নাস্তা        | day    |         | existing                                                                       |
| Nasta (Snack)             | নাস্তা                           | day    |         | existing                                                                       |
| Lunch                     | দুপুরের খাবার              | day    |         | existing                                                                       |
| Dinner                    | রাতের খাবার                  | day    |         | existing                                                                       |
| Chef House Rent           | বাবুর্চির বাসা ভাড়া | month  |         | existing                                                                       |
| Home Utility              | বাসার ইউটিলিটি বিল     | month  |         | existing — chef's home electric/water/gas bill                                |
| Shop Rent                 | দোকান ভাড়া                  | month  |         | existing                                                                       |
| Shop Electric Bill        | দোকানের বিদ্যুৎ বিল   | month  |         | new — split out of "Shop Utility"                                             |
| Shop Water Bill           | দোকানের পানির বিল       | month  |         | new                                                                            |
| Shop Cleaning             | দোকান পরিষ্কার            | month  | trip    | new — seen as "Cleaner Bill"                                                  |
| Auto Fare                 | অটো ভাড়া                      | trip   |         | existing — everyday small trips                                               |
| Bulk Transport / Van Hire | বড় পরিবহন ভাড়া         | trip   |         | new — seen as "Transport Mirpur" (৳530, much bigger than a normal Auto Fare) |
| Cold Drink                | কোল্ড ড্রিংক                | pc     |         | existing                                                                       |

## 10. Shop Operations & Repairs *(new category)*

Everything about keeping the physical setup running — gas, hardware fixes, small tools.

| Item                             | Bengali                                               | Unit     | Options | Notes                                                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gas Cylinder Refill – Shop/Cart | গ্যাস সিলিন্ডার (দোকান/কার্ট) | cylinder |         | new                                                                                                                                                                   |
| Gas Cylinder Refill – Chef Home | গ্যাস সিলিন্ডার (বাসা)              | cylinder |         | new                                                                                                                                                                   |
| Repair & Maintenance Work        | মেরামত কাজ                                   | job      |         | new, lump — electric/burner/hardware fixes at home or shop/cart (e.g. "Fan Setting Cost", "Light Making by Parvez"); put*what broke and where* in the line's notes |
| Hardware/Tools                   | হার্ডওয়্যার/টুলস                     | pc       |         | new — Scissors, Stapler, Thread Tape, etc.                                                                                                                           |
| Cash Box                         | ক্যাশ বক্স                                   | pc       |         | new — one-off equipment purchase                                                                                                                                     |

## 11. Other / fallback

Keep a plain **"Other (please specify)"** option for genuine one-offs that don't fit
anywhere above — but the goal is that it's rarely needed after this list is in place.

**Not a bazar item — track separately:** anything like `Sujit Receivable` / `Sujit due` is
money owed *by* a staff member, not a purchase. It shouldn't go in the bazar item list at
all (it distorts the day's expense total). For now, keep noting it in the day's Notes field;
when we fix the app this deserves its own small ledger rather than living inside bazar
items.

---

## Reconciliation Map

Every free-text "Other" name found in your export (`soupresso-backfill-2026-09-17.json`),
mapped to what it should become when you reopen `daily-backfill.html`:

| As typed                                                        | → New catalog item                                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Onthon sheet / Onthon Sheet                                     | Onthon Sheet                                                                                                                        |
| Mint Leaf / Mint Leaf (250gm)                                   | Mint Leaf (Pudina)                                                                                                                  |
| Barlie / Barley                                                 | Barley (Barlie)                                                                                                                     |
| Gas for Cart                                                    | Gas Cylinder Refill – Shop/Cart                                                                                                    |
| Wrapping poly                                                   | Poly Bag – Small or Large (Carry), whichever size it was                                                                           |
| Sujit due / Sujit Receivable                                    | *Not a bazar item* — keep in Notes, don't re-add as an item                                                                      |
| One time spoon                                                  | One-Time Plastic Spoon                                                                                                              |
| Scissors                                                        | Hardware/Tools                                                                                                                      |
| Thonga Paper Pack / Thonga Paper pack / Thonga Paper Pack Large | Paper Pack / Thonga – Small or Large                                                                                               |
| Chef Medicine                                                   | *(no clean fit — keep as Other, or add "Staff Medical" if this recurs)*                                                          |
| Thai Ginger                                                     | Thai Ginger                                                                                                                         |
| Fish                                                            | Fish                                                                                                                                |
| Sauce Cup (100pc)                                               | Sauce Cup                                                                                                                           |
| Straw & Sauce Cap (200pc)                                       | Straw & Cap                                                                                                                         |
| Bit Salt (1kg)                                                  | Bit Lobon (Black Salt)                                                                                                              |
| Ice                                                             | Ice                                                                                                                                 |
| Ice Carrying                                                    | Ice Carrying/Delivery                                                                                                               |
| Wheel Powder & Majoni / Wheel Powder                            | *(unclear — likely a cleaning/washing powder brand; suggest a generic "Cleaning Supplies" item if this recurs)*                  |
| Sausage (4packet) / (5Packet) / (8packet)                       | Sausage                                                                                                                             |
| Garbage Poly (500gm)                                            | Garbage Bag                                                                                                                         |
| Cleaner Bill                                                    | Shop Cleaning                                                                                                                       |
| Meat Box (100pc)                                                | Meat Box (ready-made)                                                                                                               |
| Fan Setting Cost                                                | Repair & Maintenance Work                                                                                                           |
| Transport Mirpur                                                | Bulk Transport / Van Hire                                                                                                           |
| Water (48 pc)                                                   | Water Bottle – 500ml or 250ml, whichever size                                                                                      |
| Steel Bati                                                      | Mixing Bati                                                                                                                         |
| Sauce Poly (250gm)                                              | *(a poly for sauce — fold into Poly Bag – Small unless it's meaningfully different)*                                            |
| Hand Poly for Parcel (1.5kg)                                    | Poly Bag – Small or Large (Carry)                                                                                                  |
| White Papper (100gm)                                            | Black Pepper Powder (likely a mis-transcription of "White Pepper" — confirm)                                                       |
| Cash Box for Cart                                               | Cash Box                                                                                                                            |
| Naga Achar                                                      | Naga Achar (Pickle)                                                                                                                 |
| Stapler                                                         | Hardware/Tools                                                                                                                      |
| Light Making by Parvez                                          | Repair & Maintenance Work                                                                                                           |
| Thread Tape                                                     | Hardware/Tools                                                                                                                      |
| Bazar (lump sum from old record)                                | *Not a real item* — this was a placeholder the tool inserted before you itemized the day; replace with real items, don't keep it |

---

## Suggested next steps

1. You review/adjust this list (rename, drop, or add anything I got wrong or missed).
2. Reopen `daily-backfill.html`, and for each day, swap "Other" lines over to their new
   catalog match using the map above (units/quantities you already entered stay as-is,
   this is just fixing the item identity).
3. Once the JSON is clean, we import it into the database.
4. Then we update `schema.sql`'s `bazar_items` seed and the live app's picker to match this
   finalized list, so future entries default to the right categories/units from day one.
