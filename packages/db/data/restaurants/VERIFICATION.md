# Restaurant foods verification

This is the written record of where each restaurant food in `restaurant-foods.csv` comes from, how it was read and what was left out. The rules for a row are in KEY-940 and ADR 0003 Amendment 18. The CSV holds facts only: numbers, the item's name, a URL and a date. No page, PDF, image or marketing text is copied into the repository.

Every figure was read from the chain's own UK source on **2026-11-10**, the `retrieved_on` of every row. Figures on a chain's page change, so that date is the claim, and refreshing them is a later wave. No third-party site, no other country's site, Open Food Facts and no memory was used for any value.

## Method

- Each source was fetched with `curl` and a plain User-Agent that says what the client is (`KeyLowDataBot/1.0 (nutrition data check; honest client)`). No client was disguised.
- The CSV columns hold the per portion figures as published, and `portion_grams` holds the weight the chain publishes for that portion (`weight_basis` is `published`). No weight was derived or estimated in wave 1.
- `published_kcal_per_100g` is the chain's own per 100 g energy figure, kept only so a test can check the weight and the per portion energy against each other. The generator works out the per 100 g columns itself, as the per portion figure times 100 over the grams, to two decimals.
- Every one of the 30 rows passes the checks in `test/unit/restaurant/restaurantFoodsCsv.test.ts`, which run in CI: energy within 15% of 4 x protein + 4 x carbohydrate + 9 x fat + 2 x fibre, the generated per 100 g energy within 2% of the published per 100 g energy, and the other rules of the ticket.
- A figure the chain rounds (Greggs prints two significant figures) is stored as printed.

## Chains

| Chain         | Rows | Source page (in `source_url`)                                                         | What was read                                                                                                                                                                                                 |
| ------------- | ---- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greggs        | 12   | https://www.greggs.co.uk/nutrition                                                    | The "Nutritional Information (Guide only)" PDF the page links, marked "Information correct at time of print (October 2026)". It lists the portion size in g or ml, and values per 100 g and per portion.      |
| Pret A Manger | 10   | https://www.pret.co.uk/en-GB/products/categories/&lt;category&gt;/&lt;subcategory&gt; | The product listing pages for hot pastries, breakfast pastries, sandwiches and hot toasted sandwiches. Each product carries its average weight in g and its energy and nutrients per serving and per 100 g.   |
| Subway        | 8    | https://www.subway.com/en-gb/menunutrition/nutrition                                  | The "Nutrition Information November 2026, UK and ROI" PDF the page links. The Subs table gives the serving size in g and the values per serving, which is one six-inch sub, and per 100 g. Footlongs are out. |
| McDonald's    | 0    | https://www.mcdonalds.com/gb/en-gb/product/big-mac.html                               | Nothing. Every request returned 403 "Access Denied" (see below).                                                                                                                                              |

The Greggs PDF is hosted on the chain's content network, not on `greggs.co.uk`, so `source_url` names the page that links it. The Subway PDF is on `media.subway.com`, which the same page links.

### McDonald's: not fetched

On 2026-11-10 an honest, identified client got `403 Access Denied` from `www.mcdonalds.com` for `/gb/en-gb.html`, `/gb/en-gb/menu.html` and `/gb/en-gb/product/big-mac.html`. The block was not worked around, so no McDonald's row is in the CSV and no figure of theirs was filled in from elsewhere. The chain needs to be read in a normal browser session, or moved to KEY-943 as per portion rows if it publishes no weight.

### Names

`name` is the chain's item name. Three are shortened or tidied:

- Greggs "Sausage Roll(s)" is "Sausage Roll", the PDF's plural marker dropped.
- Every Subway name has "Sub" appended, as Subway's own UK menu words them ("Create your own Chicken Tikka Sub"), so that "Chicken Breast Sub" is not mistaken for the meat when someone searches "chicken breast". The PDF's "Italian B.M.T" is "Italian B.M.T. Sub", and "Meatball Marinara (Pork & Beef Meatballs)" is "Meatball Marinara Sub". The refs keep the PDF names.
- Subway items are the rows of the Subs table, so they are the six-inch subs.
- Subway's six-inch figures cover bread, protein and vegetables only, with no cheese or sauce.

## Search

A plain "sausage roll" search now leads with the Greggs sausage roll, because its name is exactly the query. A CoFID or USDA sausage roll is still in the first 5 results, and `restaurant_foods_wave1.test.sql` asserts both. Ranking was not changed.

## Reviewer's sample

To be filled in by the reviewer, independently of the engineer: every McDonald's burger (none in this wave) and a random 20% of the rest, at least 3 per chain, each re-read from its source and compared with the CSV.

| Ref                                       | Source read                                                                                                  | kcal | Weight   | Matches |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- | -------- | ------- |
| greggs-gb:sausage-roll                    | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 347  | 103 g    | Yes     |
| greggs-gb:steak-bake                      | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 411  | 136.4 g  | Yes     |
| greggs-gb:chicken-bake                    | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 420  | 150.4 g  | Yes     |
| greggs-gb:cheese-and-onion-bake           | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 436  | 141.4 g  | Yes     |
| greggs-gb:vegetable-bake                  | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 430  | 150.4 g  | Yes     |
| greggs-gb:sausage-bean-and-cheese-melt    | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 456  | 149.4 g  | Yes     |
| greggs-gb:sausage-breakfast-roll          | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 377  | 154 g    | Yes     |
| greggs-gb:bacon-breakfast-roll            | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 321  | 119.5 g  | Yes     |
| greggs-gb:pepperoni-pizza                 | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 640  | 172 g    | Yes     |
| greggs-gb:southern-fried-chicken-baguette | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 557  | 223.68 g | Yes     |
| greggs-gb:ham-and-cheese-toastie          | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 543  | 207.36 g | Yes     |
| greggs-gb:all-butter-croissant            | Greggs nutrition PDF (Oct 2026 print), per portion and per 100 g columns, all nine fields and per 100 g kcal | 292  | 79 g     | Yes     |
| pret-gb:prets-sausage-roll                | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 384  | 110 g    | Yes     |
| pret-gb:all-butter-croissant              | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 291  | 71 g     | Yes     |
| pret-gb:chocolate-croissant               | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 350  | 86 g     | Yes     |
| pret-gb:ham-and-cheese-croissant          | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 312  | 98 g     | Yes     |
| pret-gb:free-range-egg-mayo               | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 367  | 169 g    | Yes     |
| pret-gb:classic-super-club                | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 516  | 227.1 g  | Yes     |
| pret-gb:ham-and-cheese                    | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 519  | 188.62 g | Yes     |
| pret-gb:mature-cheddar-and-pret-pickle    | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 496  | 218.1 g  | Yes     |
| pret-gb:classic-cheese-bloomer-toastie    | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 647  | 198.5 g  | Yes     |
| pret-gb:ham-and-cheese-bloomer-toastie    | Pret category page product data, perServing and per100g, all nine fields and per 100 g kcal                  | 601  | 212 g    | Yes     |
| subway-gb:italian-bmt                     | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 386  | 139 g    | Yes     |
| subway-gb:meatball-marinara               | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 447  | 243 g    | Yes     |
| subway-gb:spicy-italian                   | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 498  | 186 g    | Yes     |
| subway-gb:chicken-tikka                   | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 345  | 197 g    | Yes     |
| subway-gb:chicken-breast                  | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 340  | 198 g    | Yes     |
| subway-gb:tuna-mayo                       | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 400  | 200 g    | Yes     |
| subway-gb:veggie-delite                   | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 227  | 163 g    | Yes     |
| subway-gb:ham                             | Subway UK and ROI Nov 2026 PDF, Subs table, serving and per 100 g, all nine fields and per 100 g kcal        | 324  | 182 g    | Yes     |

Read on 2026-11-10 by the reviewer, independently of the engineer, with `curl` and the same honest User-Agent. All 30 rows were checked (the brief asked for about a third and at least 4 per chain), field by field: portion grams, kcal, protein, fat, saturates, carbohydrate, sugars, fibre, salt, and the published per 100 g kcal. No mismatch beyond printed rounding.
