---
title: Package weights and assumptions
---

# Package weights: how they're assigned and what we assume

*How the Specialty Crop Dashboard turns USDA package prices into $/lb, and the assumptions behind it. This page mirrors [`backend_update/PACKAGE_WEIGHTS.md`](https://github.com/alamaspersonal/SpecialtyCropDashboard/blob/main/backend_update/PACKAGE_WEIGHTS.md), which also covers how maintainers change the table.*

USDA reports prices per package ("40 lb cartons", "cartons tray pack", "flats 12 1-pint baskets"). To compare prices across packages, the pipeline converts a package price to **$/lb**, but only when the package's net weight is known. When it isn't, the app shows the price per package and never guesses.

The code lives in [`backend_update/format_data.py`](https://github.com/alamaspersonal/SpecialtyCropDashboard/blob/main/backend_update/format_data.py). The reference weights live in [`backend_update/package_units.json`](https://github.com/alamaspersonal/SpecialtyCropDashboard/blob/main/backend_update/package_units.json).

## How a row gets its weight

Every row goes through these steps in order. The first one that produces a result wins.

1. **Read it from the package name.** `parse_package_measures()` handles names that state a weight or a count, such as "25 lb sacks", "10 kg containers" or "cartons 12 1-lb film bags".
2. **Look it up in the reference table.** This applies only when step 1 found neither a weight nor a count. `reference_weight()` looks up names that don't state a weight, such as "cartons tray pack" or "1 1/9 bushel cartons", in `package_units.json`.
3. **Otherwise, leave the row unweighted.**

The prices are then computed as follows:

- `price_avg` is the mean of whichever USDA price fields the row has: low, high, mostly low, mostly high and weighted average. Retail rows store a range such as "2.99-3.49", so the pipeline parses both ends.
- `price_per_lb = round(price_avg / weight_lbs, 2)` when a weight is known.
- `price_per_unit = round(price_avg / units, 2)` only when there is a count and **no** weight. When both are known, weight wins. For example, "flats 8 1-lb containers" is priced per lb, not per container.
- If neither is known, both are null and the row is priced per package.

The apps use the same order. [`shared/priceEntries.js`](https://github.com/alamaspersonal/SpecialtyCropDashboard/blob/main/phone_frontend/src/shared/priceEntries.js) uses $/lb if `price_per_lb` is set, then $/each if `price_per_unit` is set, then $/package. $/lb prices average together across packages. $/each and $/package prices are never averaged across different packages.

## Assumptions in the package-name parser

`parse_package_measures()` takes a stated figure at face value as the net weight of the whole package. On top of that, it assumes the following.

| Package wording | What we do | Example |
|---|---|---|
| Both kg and lb stated | Use both figures as written, with no conversion | "9 kg (19.8 lb) containers" → 19.8 lb |
| "per lb", "per pound" | Treat the price as being for 1 lb | "per lb" → 1 lb |
| Count × per-unit weight | Multiply them | "cartons 4 2-1/2 lb film bags" → 10 lb |
| A weight range | Use the **midpoint** (a deliberate rule, confirmed 2026-11-19) | "30-35 lb cartons" → 32.5 lb |
| Kilograms | 1 kg = 2.20462 lb (`LB_PER_KG`) | "10 kg containers" → 22.05 lb |
| Ounces | 16 oz = 1 lb, with ranges at the midpoint. Fluid ounces (a name containing "gallon") are skipped | "6 oz package" → 0.38 lb |
| Grams | 1000 g = 1 kg | "flats 12 125-gm cups" → 3.31 lb |
| Pints, cups (volume) | No weight, because it depends on the crop. Priced per container | "flats 12 1-pint baskets" → 12 units |
| "N count" packs | Count only. Packs of packs multiply | "12 3-count packages" → 36 units |
| "each", "per bunch", "per sleeve" | Priced per item | units = 1 |
| Bushels and bare containers | Nothing. Step 2 may fill these in | "1 1/9 bushel cartons", "bins", "lugs" |

Both `weight_lbs` and `weight_kgs` are stored and rounded to 2 decimals. Whichever one wasn't stated is converted from the other.

## The reference table (`package_units.json`)

### Source: one table, nothing else

Every entry comes from **USDA AMS, *Fresh Fruit and Vegetable Shipments, Calendar Year 2023* (FVAS-4, issued April 2024), "Container Approximate Net Weights"** ([PDF](https://www.ams.usda.gov/sites/default/files/media/AnnualFreshFruitsandVegetableShipments2023.pdf)). AMS publishes this table as the conversion factor it uses to turn package counts into pounds. The 2023 edition is the newest. Each entry's `source` field quotes the row it came from.

We don't use any other source, including other USDA publications, trade references or estimates. Other USDA sources disagree with this table on several packages. [`package_weight_conflicts.csv`](https://github.com/alamaspersonal/SpecialtyCropDashboard/blob/main/backend_update/package_weight_conflicts.csv) lists those packages side by side for reference. **If a package isn't in the 2023 table, it stays unweighted.**

### Matching rules

1. **The wording must match the 2023 row. We infer no sizes or container types.** If the row says "Carton (CA)" and our package says "7/10 bushel cartons", that isn't a match, because the row doesn't state the size. The same holds the other way round: if a row names a size, our package must name the same size.
2. **The match is on exact text.** The key is the commodity plus the package, lowercased and trimmed. "1 1/9 Bushel Crates" doesn't pick up the "1 1/9 bushel cartons" entry.
3. **Count qualifier (`item_count`).** When a USDA row is for a specific pack count, such as "Carton 24's", the entry applies only if the row's `item_size` states a count in that range: "24s", "film lined 24s" or "48s medium". The count is the number before an `s`. Sizes like tomatoes' "4x5s" are dimensions, not counts, and are ignored.
4. **Place qualifier (`origins`).** When a USDA row is for a specific origin, such as "Carton (AZ)" or "2-layer carton (CL)", the entry applies only to rows grown there. The place is the row's `origin`. Shipping-point rows have no origin, so the place comes from the district:
   - A district starting with "Mexico" (e.g. "Mexico Crossings Through Texas") → Mexico.
   - A district mentioning Mexico elsewhere → unknown, because domestic and Mexican product are reported together.
   - A district ending in "California" (e.g. "Kern District California") → California.
   - Any other district is used as is (e.g. "Georgia").
5. **Exactly one weight.** After the qualifiers, all matching entries must agree on a single weight. If none match, or the matches disagree, the row stays unweighted. For example, endive from "Arizona-California" could be either 25 lb (CA) or 34 lb (AZ).

### Judgment calls we made

These entries required a reading of the row beyond word-for-word matching. Each is a candidate for removal if we want to be stricter.

- **Sweet corn "wirebound crates" → 42 lb.** The row says "Carton or crate", and a wirebound crate is a crate.
- **Romaine "Carton 24's (west)" → 40 lb for California, Arizona and Arizona-California.** We read "west" as those three.
- **Watermelon "Carton imports" → 35 lb for Mexico, Guatemala, Honduras, Costa Rica and Panama.** These are the import origins that appear in our data. The plain "Carton" row (85 lb) applies to US states and Arizona-California. Districts that don't name one place, such as "Baja District", stay unweighted.
- **"Peppers, other" rows apply to the peppers footnote 11 lists under "Peppers other":** anaheim, cherry hots, chilaca, cubanelle, fresno, habanero, Hungarian wax, jalapeño, manzano, pasilla, poblano, serrano, Thai chili hots and yellow chile. Bell peppers have their own rows. Arbol and shishito aren't listed, so they stay unweighted.
- **Green leaf, red leaf and Boston lettuce use the "Lettuce, other leaf" row.** Footnote 6 lists all three under "Lettuce, Other". **Endive and escarole share the "Escarole & endive" row.**
- **"(AZ & CA)" rows apply to California, Arizona and Arizona-California:** lemons cartons (38 lb) and tangerines ½ cartons (25 lb).
- **Single-state rows apply only to that state:** oranges "Carton (CA)" (40 lb) only to California, "4/5 bushel carton (FL)" (43 lb) only to Florida, and "7/10 bushel carton (TX)" (42 lb) only to Texas. Plums "2-layer carton or lug (CL)" (18 lb) applies only to Chile.
- **"Cartons/Crates" or "Cartons/Lugs" in our data matches a row's "carton or crate" / "carton or lug".**
- **Avocados:** only California (25 lb) and Chile (23 lb) have rows. Mexican and other avocados stay unweighted.

### Entries

All 111 entries, generated from `package_units.json`. "Only when" lists the count or origin qualifier.

| Commodity | Our package | lb | Only when | 2023 row (commodity, container) |
|---|---|---|---|---|
| Apple Pears | Cartons 1 Layer | 11 | — | FRUIT, OTHER (Apple Pear), Carton 1-layer |
| Apple Pears | Cartons 2 Layer | 22 | — | FRUIT, OTHER (Apple Pear), Carton or lug 2-layer |
| Apples | Cartons Tray Pack | 40 | — | APPLES, Carton, tray or cell pack |
| Apricots | Cartons 2 Layer Tray Pack | 18 | — | APRICOTS, 2-layer carton tray pack |
| Apricots | Cartons Loose | 24 | — | APRICOTS, Carton loose |
| Artichokes | Cartons | 23 | — | ARTICHOKES, Carton |
| Avocados | Cartons 2 Layer | 25 | California | AVOCADOS, 2-layer carton (CA) |
| Avocados | Cartons 2 Layer | 23 | Chile | AVOCADOS, 2-layer carton (CL) |
| Beans, Round Green Type | Bushel Cartons | 30 | — | BEANS, GREEN, Bushel basket, carton or crate |
| Beans, Round Green Type | Bushel Cartons/Crates | 30 | — | BEANS, GREEN, Bushel basket, carton or crate |
| Beans, Round Green Type | Bushel Crates | 30 | — | BEANS, GREEN, Bushel basket, carton or crate |
| Beets | Cartons Bunched | 20 | count 12 | BEETS, Carton or crate, 12's |
| Beets | Crates Bunched | 20 | count 12 | BEETS, Carton or crate, 12's |
| Bok Choy | Cartons | 30 | — | BOK CHOY, Carton or crate |
| Bok Choy | Wga Crates | 70 | — | BOK CHOY, WGA type crate |
| Broccoli | Cartons | 23 | count 14–18 | BROCCOLI, Carton or crate, 14-18's |
| Cantaloupes | 1/2 Cartons | 40 | — | CANTALOUPS, 1/2 Carton or crate |
| Cantaloupes | 2/3 Cartons | 54 | — | CANTALOUPS, 2/3 carton or crate |
| Cauliflower | Cartons Film Wrapped | 25 | — | CAULIFLOWER, Carton film wrapped |
| Celery | Cartons | 60 | — | CELERY, Carton or crate |
| Chayote | Cartons | 40 | — | CHAYOTE, Carton |
| Chinese Cabbage | Celery Crates | 50 | — | CHINESE CABBAGE, Celery crate |
| Chinese Cabbage | Wga Crates | 70 | — | CHINESE CABBAGE, WGA type crate |
| Cilantro | 1 1/9 Bushel Crates Bunched | 21 | — | CILANTRO, 1-1/9 bushel carton or crate bunched |
| Cilantro | Cartons Bunched | 11 | count 30 | CILANTRO, Carton bunched 30's |
| Corn, Sweet | Cartons | 42 | — | CORN, SWEET, Carton or crate |
| Corn, Sweet | Cartons/Crates | 42 | — | CORN, SWEET, Carton or crate |
| Corn, Sweet | Wirebound Crates | 42 | — | CORN, SWEET, Carton or crate |
| Cucumbers | 1 1/9 Bushel Cartons | 55 | — | CUCUMBERS, 1-1/9 bushel carton or crate |
| Cucumbers | 1 1/9 Bushel Cartons/Crates | 55 | — | CUCUMBERS, 1-1/9 bushel carton or crate |
| Cucumbers | 1 1/9 Bushel Crates | 55 | — | CUCUMBERS, 1-1/9 bushel carton or crate |
| Cucumbers | Cartons | 22 | count 24 | CUCUMBERS, Carton 24s |
| Eggplant | 1 1/9 Bushel Cartons | 33 | — | EGGPLANT, 1-1/9 bushel carton or crate |
| Endive | Cartons | 34 | Arizona | ESCAROLE & ENDIVE, Carton (AZ) |
| Endive | Cartons | 25 | California | ESCAROLE & ENDIVE, Carton |
| Escarole | Cartons | 34 | Arizona | ESCAROLE & ENDIVE, Carton (AZ) |
| Escarole | Cartons | 25 | California | ESCAROLE & ENDIVE, Carton |
| Honeydews | 2/3 Cartons | 30 | — | HONEYDEWS & MISC MELONS, 2/3 Carton or crate |
| Honeydews | Flat Crates | 35 | — | HONEYDEWS & MISC MELONS, Flat crate |
| Kiwifruit | Flats 1 Layer | 7 | — | KIWIFRUIT, 1-layer flat |
| Lemons | Cartons | 38 | California, Arizona, Arizona-California | LEMONS, Carton (AZ & CA) |
| Lettuce, Boston | Cartons | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Boston | Cartons Film Lined | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Green Leaf | Cartons | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Green Leaf | Cartons Film Lined | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Iceberg | Cartons | 50 | count 24 | LETTUCE, ICEBURG [sic], Carton, 24's |
| Lettuce, Red Leaf | Cartons | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Red Leaf | Cartons Film Lined | 20 | count 24 | LETTUCE, OTHER LEAF, Carton 24's |
| Lettuce, Romaine | Cartons | 40 | count 24; California, Arizona, Arizona-California | LETTUCE, ROMAINE, Carton 24's (west) |
| Lettuce, Romaine | Cartons Film Lined | 40 | count 24; California, Arizona, Arizona-California | LETTUCE, ROMAINE, Carton 24's (west) |
| Mangoes | Flats 1 Layer | 10 | — | MANGOES, 1-layer flats |
| Okra | 1/2 And 5/9 Bushel Cartons/Crates | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Okra | 1/2 Bushel Cartons | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Okra | 1/2 Bushel Cartons/Crates | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Okra | 1/2 Bushel Crates | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Okra | 5/9 Bushel Cartons | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Okra | 5/9 Bushel Crates | 15 | — | OKRA, 1/2 & 5/9 bushel carton or crate |
| Onions, Green | Cartons Bunched | 13 | count 48 | ONIONS, GREEN, Carton 48' bunched [sic] |
| Oranges | 4/5 Bushel Cartons | 43 | Florida | ORANGES, 4/5 bushel carton (FL) |
| Oranges | 7/10 Bushel Cartons | 42 | Texas | ORANGES, 7/10 bushel carton (TX) |
| Oranges | Cartons | 40 | California | ORANGES, Carton (CA) |
| Pears | 4/5 Bushel Cartons | 45 | — | PEARS, 4/5 bushel box or carton |
| Peppers, Anaheim | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Anaheim | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Bell Type | 1 1/9 Bushel Cartons | 28 | — | PEPPERS, 1-1/9 bushel carton or crate |
| Peppers, Bell Type | 1 1/9 Bushel Cartons/Crates | 28 | — | PEPPERS, 1-1/9 bushel carton or crate |
| Peppers, Bell Type | 1/2 Cartons | 15 | — | PEPPERS, 1/2 cartons |
| Peppers, Bell Type | Flat Cartons | 11 | — | PEPPERS, Flat carton |
| Peppers, Cherry Hot | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Chilaca | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Cubanelle | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Cubanelle | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Fresno | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Fresno | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Fresno | 1/2 Bushel Cartons/Crates | 15 | — | PEPPERS, OTHER, 1/2 & 5/9 bushel carton or crate |
| Peppers, Habanero | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Habanero | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Hungarian Wax | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Hungarian Wax | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Jalapeno | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Jalapeno | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Manzano | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Pasilla | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Pasilla | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Poblano | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Poblano | 1 1/9 Bushel Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Serrano | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Serrano | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Thai Chili Hots | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Thai Chili Hots | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Yellow Chile | 1 1/9 Bushel Cartons | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Peppers, Yellow Chile | 1 1/9 Bushel Cartons/Crates | 30 | — | PEPPERS, OTHER, 1-1/9 bushel carton or crate |
| Persimmons | Cartons 1 Layer | 11 | — | PERSIMMONS, 1-layer carton or lug |
| Persimmons | Cartons 2 Layer | 22 | — | PERSIMMONS, 2-layer carton or lug |
| Persimmons | Cartons/Lugs 1 Layer | 11 | — | PERSIMMONS, 1-layer carton or lug |
| Persimmons | Lugs 1 Layer | 11 | — | PERSIMMONS, 1-layer carton or lug |
| Pineapples | Cartons 1 Layer | 20 | — | PINEAPPLES, 1-layer carton |
| Pineapples | Cartons 2 Layer | 40 | — | PINEAPPLES, 2-layer carton |
| Plums | Cartons 2 Layer | 18 | Chile | PLUMS, 2-layer carton or lug (CL) |
| Pomegranates | Cartons 2 Layer | 22 | — | POMEGRANATES, 2-layer carton or lug |
| Pomegranates | Cartons/Lugs 2 Layer | 22 | — | POMEGRANATES, 2-layer carton or lug |
| Radishes | Cartons Bunched | 35 | count 48 | RADISHES, Carton or crate, 48 bunched |
| Spinach | Cartons Bunched | 20 | count 24 | SPINACH, Carton 24s bunched |
| Tangelos | 1/2 Bushel Cartons | 25 | — | TANGELOS, 1/2 bushel carton |
| Tangelos | 4/5 Bushel Cartons | 43 | — | TANGELOS, 4/5 bushel carton |
| Tangerines | 1/2 Cartons | 25 | California, Arizona, Arizona-California | TANGERINES, 1/2 carton (AZ & CA) |
| Tangerines | 4/5 Bushel Cartons | 43 | — | TANGERINES, 4/5 bushel carton or crate |
| Tomatoes | Flats 1 Layer | 15 | — | TOMATOES, 1-layer flats |
| Tomatoes | Flats 2 Layer | 20 | — | TOMATOES, 2-layer flats |
| Watermelons | Cartons | 85 | US origins | WATERMELONS, Carton |
| Watermelons | Cartons | 35 | Mexico, Guatemala, Honduras, Costa Rica, Panama | WATERMELONS, Carton imports |

### Left out on purpose

Every unweighted package in our data was compared to the 2023 table on 2026-11-19. These come close to a row but don't match it exactly, so they stay unweighted and are shown per package. Row counts are as of November 2026.

| Our package | 2023 row says | Why it doesn't match | Rows |
|---|---|---|---|
| Oranges, 7/10 bushel cartons (California and others) | "Carton (CA)" = 40, no size | Size not stated. Only Texas has a "7/10 bushel carton (TX)" row | ~91,000 |
| Peaches / nectarines / plums, cartons 2 layer **tray pack** | "2-layer carton or lug" (CA) 22 / (CL) 18 | The row doesn't say tray pack | ~77,000 |
| Greens (collard, dandelion, kale, mustard, chard), cartons bunched | "**Bushel** basket, carton or crate" | Our package doesn't say bushel | ~60,800 |
| Pears, 4/5 bushel cartons **wrapped**; eggplant, 1 1/9 bushel cartons **wrapped** | "4/5 bushel box or carton"; "1-1/9 bushel carton or crate" | The row doesn't say wrapped | ~66,700 |
| Hard squash (acorn, butternut, kabocha, red kuri, spaghetti), 1 1/9 bushel cartons | "Carton or crate" = 40, no size | Size not stated | 18,978 |
| Tomatoes, cartons 2 layer | "2-layer **flats**" = 20 | Flat ≠ carton | 18,048 |
| Cucumbers (long seedless), cartons film wrapped | "**Greenhouse** film wrapped 12's" | Our package doesn't say greenhouse | 13,993 |
| Cucumbers, cartons not stating 24s | "Carton 24s" = 22 | Different pack count | ~14,300 |
| Melons other than honeydew (casaba, crenshaw, galia, hami, …), 2/3 cartons | "HONEYDEWS & MISC MELONS, 2/3 carton or crate" | The footnote that lists these melons is titled "Mixed & Misc Melons", not the container heading | ~12,500 |
| Spinach, cartons | "Carton or crate **loose**" = 25 | The row says loose | 5,405 |
| Peppers (anaheim, jalapeño, …), cartons/crates | "PEPPERS, OTHER, Carton" = 10 | The row doesn't say crate | ~4,400 |
| Bananas, cartons institutional pack | "Carton IP" = 50 | Abbreviation, not the same words | 1,349 |
| Celery, cartons film bags | "**Hearts** – carton film bags" = 28 | Our package doesn't say hearts | 1,188 |
| Peppers, arbol and shishito | "PEPPERS, OTHER" rows | Footnote 11 doesn't list them | ~1,000 |
| Tangerines, 1/2 bushel cartons | "½ carton (AZ & CA)" = 25 | ½ carton ≠ ½ bushel carton | 6,665 |
| Parsley, cartons bunched | "1-1/9 bushel carton or crate bunched" = 21 | Our package doesn't say bushel size | 25,857 |
| Cabbage, 1 3/4 bushel cartons / crates | "Carton, crate or sack", no size | Size not stated | 364 |
| Watermelons, bins | 24" bin, 36" bin, 2/3 bin (725–1050) | Ours doesn't say which bin | 831 |
| Garlic, cartons; papaya, cartons | "Carton" = 22 & 30; 10, 25 & 37 | Several weights | 601 |
| Clementines, cartons | Only kg-marked crates and cartons | No plain carton row | 111 |
| Bok choy, celery crates | Only Chinese cabbage has a celery-crate row | Different commodity | 39 |
| Figs, misc herbs, misc Asian and tropical vegetables, misc citrus | — | No container row for them | — |
