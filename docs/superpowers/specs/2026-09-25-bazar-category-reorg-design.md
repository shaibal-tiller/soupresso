# Bazar catalog category reorganization — design

**Date:** 2026-09-25
**Status:** Approved (agreed turn-by-turn in chat during brainstorming; this doc records the
final plan for the record, not a fresh review round).

## Problem

Categories grew organically and now mix concerns: "Staff & Home" contains both staff/home costs
*and* shop rent/utility/cleaning; "Packaging" and "Serving & Seating" split what the user treats
as one workflow; a few items (gas cylinders, wonton sheet) sit in a category that doesn't match
what they're actually for. Separately, 39 of 554 historical `bazar_plan_items` rows are free-text
(no `item_id`) — some just never got linked to a catalog item that already exists, a few are
genuine spelling/naming variants of the same real item, and the rest are one-off items never
added to the catalog at all.

## Decisions (confirmed in chat)

**Grouping, not a deeper hierarchy.** `bazar_categories` gets a new `group_name TEXT` column
purely for visual grouping (e.g. "Overhead", "Cooking") in the catalog page and picker — no
change to `bazar_items.category`, no new drill-down level.

**Category changes:**
- Split "Staff & Home" into *Staff & Home* (salary, home rent/utility, chef nasta/auto fare,
  chef medicine, chef-home gas refill) and a new *Shop* category (shop rent/utility/cleaning,
  cash box, repair & maintenance, hardware/tools, bulk transport, cart gas refill... — see exact
  list in the migration script). Both get `group_name = 'Overhead'`. Old "Shop Operations &
  Repairs" dissolves (all items redistributed, category deleted once empty).
- *Vegetables*, *Herbs & Leaves*, *Raw Spices*, *Processed Spices & Sauces*, *Cooking
  Essentials* all get `group_name = 'Cooking'`. "Gas Cylinder Refill - Shop/Cart" moves here
  from the old Shop Operations category (it's for the cooking cart, not the chef's home).
  "Onthon Sheet" is renamed to **Wonton Sheet** and moved here from Packaging (it's an
  ingredient, confirmed by user).
- "Serving & Seating" and "Packaging" merge into one new category, **"Serving, Seating &
  Packaging"** — both old categories deleted once empty.
- *Meat & Egg* and *Cleaning Supplies* are unchanged (confirmed fine as-is).

**New catalog items**: Chef Medicine (Staff & Home), White Pepper (Processed Spices & Sauces),
Chicken Sausage (Meat & Egg — distinct product from "Sausage"), Peeler (Cooking Essentials),
"Extra Travel / Bazar Trip" (Staff & Home — for auto-fare trips beyond the fixed daily amount).

**Free-text `bazar_plan_items` cleanup** (39 rows, matched by `lower(trim(name))`):
- Link to an existing catalog item, normalizing `name` to the canonical spelling: barley,
  cabbage, cash box, coriander powder, kabab masala, onthon sheet→Wonton Sheet, wheel powder,
  chilli powder→Chili Powder, chef nasta→Nasta (Snack), chef auto bhara→Auto Fare, burner
  fix/light/stove repair→Repair & Maintenance Work, stapler/wooden platform→Hardware/Tools,
  poly bag→Poly Bag - Small (Carry), wrapping poly→Poly Bag - Large (Carry), wheel powder &
  majoni→Wheel Powder, piller→Peeler (new item).
- Left as free text, no catalog link: "bazar (lump sum from old record)", "something else"
  (historical placeholders), "sujit due" (a one-off chef reimbursement note, not a recurring
  catalog concept), "chicken sausage" (linked to the *new* Chicken Sausage item instead, not an
  existing one).

**Auto-fare > ৳50 rule**: not a hard validation — a soft UI hint on the Auto Fare field in
`BazarItemPicker` when its price exceeds ৳50, suggesting the new "Extra Travel / Bazar Trip"
item for the additional trip instead of inflating the fixed daily amount.

## Implementation notes

All changes are additive/idempotent in `schema.sql` (matching this project's established
convention — no destructive migrations), plus a one-off, transactional, backed-up data-fix
script for the 39 free-text row updates (covered by today's earlier full-table backup,
`backups/soupresso-db-backup-2026-09-25T08-41-24-691Z.json`).

`bazar-items/page.js` and `BazarItemPicker.js`'s category browse modal both need their category
card grid updated to render a `group_name` section heading above each group's cards.
