# Restaurant foods verification

This is the written record of where each restaurant food in `restaurant-foods.csv` comes from, how it was read and what was left out. The rules for a row are in KEY-940 and ADR 0003 Amendment 18. The CSV holds facts only: numbers, the item's name, a URL and a date. No page, PDF, image or marketing text is copied into the repository.

Every figure was read from the chain's own UK source on **2026-11-10**, the `retrieved_on` of every row, except Burger King (wave 3) and Nando's (wave 4), read on **2026-11-11**. Figures on a chain's page change, so that date is the claim, and refreshing them is a later wave. No third-party site, no other country's site, Open Food Facts and no memory was used for any value.

## Method

- Each source was fetched with `curl` and a plain User-Agent that says what the client is (`KeyLowDataBot/1.0 (nutrition data check; honest client)`). No client was disguised.
- The CSV columns hold the per portion figures as published, and `portion_grams` holds the weight the chain publishes for that portion (`weight_basis` is `published`). No weight was derived or estimated. Wave 2 rows have no weight (`weight_basis` is `none`, `portion_grams` is blank), and are stored per portion with the figures as published.
- `published_kcal_per_100g` is the chain's own per 100 g energy figure, kept only so a test can check the weight and the per portion energy against each other. The generator works out the per 100 g columns itself, as the per portion figure times 100 over the grams, to two decimals.
- Every one of the 94 rows passes the checks in `test/unit/restaurant/restaurantFoodsCsv.test.ts`, which run in CI: energy within 15% of 4 x protein + 4 x carbohydrate + 9 x fat + 2 x fibre, the generated per 100 g energy within 2% of the published per 100 g energy, and the other rules of the ticket.
- A figure the chain rounds (Greggs prints two significant figures) is stored as printed.

## Chains

| Chain         | Rows | Source page (in `source_url`)                                                         | What was read                                                                                                                                                                                                  |
| ------------- | ---- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greggs        | 12   | https://www.greggs.co.uk/nutrition                                                    | The "Nutritional Information (Guide only)" PDF the page links, marked "Information correct at time of print (October 2026)". It lists the portion size in g or ml, and values per 100 g and per portion.       |
| Pret A Manger | 10   | https://www.pret.co.uk/en-GB/products/categories/&lt;category&gt;/&lt;subcategory&gt; | The product listing pages for hot pastries, breakfast pastries, sandwiches and hot toasted sandwiches. Each product carries its average weight in g and its energy and nutrients per serving and per 100 g.    |
| Subway        | 8    | https://www.subway.com/en-gb/menunutrition/nutrition                                  | The "Nutrition Information November 2026, UK and ROI" PDF the page links. The Subs table gives the serving size in g and the values per serving, which is one six-inch sub, and per 100 g. Footlongs are out.  |
| McDonald's    | 17   | https://www.mcdonalds.com/gb/en-gb/product/<item>.html                                | Wave 2. The "Nutritional Information Per Portion" table of each product page, read in a browser session (see below). No weight is published.                                                                   |
| KFC           | 17   | https://brand-uk.assets.kfc.co.uk/nutrition-allergens.pdf                             | Wave 2. The "Allergen & Nutrition Information November 2026" PDF on KFC UK's own asset host. It gives energy, fat, saturates, carbohydrate, sugars, protein and salt per item, and no weight.                  |
| Burger King   | 17   | https://www.burgerking.co.uk/nutritional-info                                         | Wave 3. The nutrition PDF the page links (see below). It gives the serving size in g, and the values per serving and per 100 g.                                                                                |
| Nando's       | 13   | https://www.nandos.co.uk/food/menu                                                    | Wave 4. The energy in kcal printed on each item of the menu page. It prints no macros, so protein, fat, saturates, carbohydrate, sugars, fibre and salt are estimated from the dish's ingredients (see below). |

The Greggs PDF is hosted on the chain's content network, not on `greggs.co.uk`, so `source_url` names the page that links it. The Subway PDF is on `media.subway.com`, which the same page links.

### McDonald's: read in a browser

On 2026-11-10 an honest, identified client got `403 Access Denied` from `www.mcdonalds.com`, and the block was not worked around. The 17 McDonald's figures in wave 2 were read from each product page's "Nutritional Information Per Portion" table in a browser session on 2026-11-10, and `source_url` names that product page. The pages give no weight, so each row has `weight_basis none` and is stored per portion, as published. The fibre figure is on the page and is kept.

### KFC: no weight, some averages

The PDF is on `brand-uk.assets.kfc.co.uk`, KFC UK's own asset host, and was fetched with `curl` and the honest User-Agent above. KFC's UK nutrition page that links it did not answer a script (the connection failed), so `source_url` names the PDF itself. The PDF gives no weight for any item, so every KFC row has `weight_basis none`.

- It publishes no fibre, so `fibre_g` is blank.
- "Original Recipe Chicken", "Tender" and "Hash Brown" are published "per piece, average", so their rows are averages as KFC prints them, with the portion label "1 piece" or "1 hash brown".
- The PDF's columns are kJ, kcal, fat, saturates, carbohydrate, sugars, protein and salt. Items marked as sold only in Ireland (the fillet rolls), drinks, sauces, desserts and limited time items are out. "Hot Wing" is out because its sugars are printed "<0.5", which is not a figure.
- Names are KFC's own: "Regular Signature Fries" has the label "1 regular fries", and "Regular Popcorn Chicken" has the label "1 regular popcorn chicken".

### Burger King: read from its PDF (wave 3)

`https://www.burgerking.co.uk/nutritional-info` is the "Nutritional info" link in the footer of burgerking.co.uk, and leads to Burger King UK's own PDF on Google Drive, "BKGUK13189-BKG Kit 6 Digital Nutrition-1080x1920_V8.pdf" (file id `18tcyQa41Ux2-Apgy2CWWDACpgIU0EQMR`, 7 pages, image-based, "Country report: United Kingdom", "Report printed: June 2026"). `source_url` names the page that links it. It was fetched on 2026-11-11 with `curl` and the honest User-Agent above, and read from page images.

- It **gives a weight**: the first column of each item is the serving size in g, and every item has a per 100 g line. So every Burger King row has `weight_basis published`, is stored per 100 g, and `published_kcal_per_100g` is the PDF's own per 100 g energy.
- The columns are serving size, kcal, kJ, fat, saturated fat, sodium, salt, carbohydrate, sugars, fibre and protein. The CSV takes the salt column, not sodium.
- Names are the PDF's, with the registered mark dropped ("Whopper®" is "Whopper") and "Bacon&Cheese" spaced ("Whopper Bacon & Cheese"). The names of the onion rings are "Onion Rings 6pc" and "Onion Rings 9pc", each its own food because the PDF lists them as separate items. Their per 100 g figures match, so a later wave may fold them into one food with two portions.
- Nuggets and fries are in. Where the PDF prints "<0.5" the field is blank: "printed as <0.5, stored blank", as KFC's unpublished fibre is. That is fibre for Chicken Nuggets 6pc only (the 9 and 20 pc serving lines print 0.7 g and 1.5 g, and only their per 100 g lines print "<0.5"), and sugars for both Fries sizes. Every other figure is as printed. The PDF lists two fries sizes, regular and small, each its own food. Labels are "1 box of 6", "1 box of 9", "1 box of 20", "1 regular fries" and "1 small fries".
- Left out because the figure is ambiguous:
  - **Big King.** Its row is inconsistent as printed (1402 kcal for 358 g, against 3416 kJ and 391 kcal per 100 g), so no energy figure can be trusted.
  - Everything else on the menu was not chosen: drinks, desserts, dips, sauces, extras, kids items, breakfast, delivery exclusives, loaded and chicken fries, and the sharer boxes. No limited time item was taken.

### Nando's: published energy, estimated macros

Zee's ruling of 2026-11-11 (ADR 0003 Amendment 20): the macros are estimated from each dish's ingredients and marked `quality.macros_estimated`. Everything below was fetched with `curl` and the plain User-Agent `KeyLowDataCheck/1.0 (nutrition data verification)`. No third-party nutrition site and no remembered figure was used.

**Sources.**

- Energy: `https://www.nandos.co.uk/food/menu`, the `kcal` printed on each item, read on 2026-11-11. Those are the `kcal` of the rows and are never scaled.
- What a dish is made of: the item's page under `https://www.nandos.co.uk/allergens/<item>`, whose "Ingredients" list is in order of weight and has no amounts. `ingredients_url` in the estimates file names the page. For the published energy of a component sold on its own (a Tortilla Wrap, a Toasted Pitta, a Grilled Chicken Breast) the same menu page was used as a sense check on the assumed weights.

**Method.** `nandos-estimates.json` lists, per item, the components, the CoFID code of the reference food for each, the assumed weight in grams of each in one portion, and the scale factor. The generator adds up the components' nutrients at those weights, then multiplies every component by one factor so the energy equals the published kcal exactly. The scaled protein, fat, saturates, carbohydrate, sugars, fibre and salt (sodium times 2.5 over 1000, as the CoFID import maps it) are the row's figures. A nutrient CoFID does not record for a reference counts as 0. Fibre is as the CoFID import stores it, AOAC where CoFID has it and otherwise NSP. `import:restaurant nandos-rows` prints the CSV lines, and `estimateNandosMacros.test.ts` recomputes them from the file and the CoFID CSV, checks every item's stored factor, and fails when the CSV and the file differ. The weights were chosen so that the components come to within about 7% of the published energy before scaling, so the factors sit between 0.95 and 1.07.

**Assumptions.**

- "From 498 kcal" and the like on the menu are taken as the regular size, because the same line says "Large serves 2". The large size's energy is not on the menu page, so no large row exists.
- The marinade and basting sauce are modelled as rapeseed oil and salt, the only parts of them that carry energy or salt at a gram or two. The spices, vinegar, lemon and garlic are left out. The energy is published for the dish "in your favourite spice", with no spice named, so no spice is modelled.
- 1/4 Chicken is "a breast or leg", and its 289 kcal is a quarter of the whole chicken's 1,159, so it is modelled as the mean of the two cuts: half of a 150 g breast quarter, grilled, meat and skin, and half of a 125 g leg quarter, roasted, meat and skin. Whole Chicken is two of each. A wing is 32 g of edible meat and skin.
- Chicken Butterfly is two breasts joined by skin: 175 g of grilled breast, meat and skin.
- Wrap and pitta are single, with the chicken breast fillet as skinless grilled breast. The yoghurt mayo, lemon and herb mayo, chilli jam and rainbow slaw have no CoFID food of their own, so retail mayonnaise, Greek style yoghurt, sugar with tomato puree, and retail coleslaw stand in, and each is named as a stand-in in the file.
- PERi-Salted Chips are straight cut frozen chips fried in oil, plus salt for the PERi-Salt. Spicy Rice is boiled long grain rice with oil, peppers, onion and tomato. Macho Peas are frozen peas with olive oil, mint and parsley. Corn on the Cob is boiled sweetcorn weighed with its core, plus the butter portion it is served with, taken as part of the published energy. Garlic Bread is white bread standing in for the Portuguese roll, with a fat spread for the garlic and chilli spread and raw garlic.
- The three Chicken Wings rows (3, 5 and 10) are the sizes the menu prints. Their kcal are 78.7 to 78.6 per wing, so they are consistent with one another.

**Names and labels.** `name` is Nando's item name, with "Regular" added to a side whose size is given as "From" (as KFC's "Regular Signature Fries"). Labels are by what the portion is: "1 quarter chicken", "1 portion of 3 wings", "1 wrap", "1 pitta", "1 regular PERi-Salted Chips".

**Left out.**

- Half Chicken, which is not on the current menu page.
- The chicken breast fillet burger, which the menu no longer lists under that name. Its allergen page exists, but there is no energy for it. The Sunset Burger and Garlic Churrasco Burger have energy, but "two chicken thighs or a breast" makes their components ambiguous, so they are left for a later wave.
- PERi-Salted Chips large, and the large size of every side, because the menu prints one "From" figure and no large figure.
- Drinks, desserts, kids' items, starters, sharing platters and extras.

### Names

`name` is the chain's item name. Three are shortened or tidied:

- Greggs "Sausage Roll(s)" is "Sausage Roll", the PDF's plural marker dropped.
- Every Subway name has "Sub" appended, as Subway's own UK menu words them ("Create your own Chicken Tikka Sub"), so that "Chicken Breast Sub" is not mistaken for the meat when someone searches "chicken breast". The PDF's "Italian B.M.T" is "Italian B.M.T. Sub", and "Meatball Marinara (Pork & Beef Meatballs)" is "Meatball Marinara Sub". The refs keep the PDF names.
- Subway items are the rows of the Subs table, so they are the six-inch subs.
- Subway's six-inch figures cover bread, protein and vegetables only, with no cheese or sauce.

## Search

A plain "sausage roll" search now leads with the Greggs sausage roll, because its name is exactly the query, and `restaurant_foods_wave1.test.sql` asserts it. Ranking was not changed. The test does not assert that a CoFID or USDA sausage roll follows, because the seeds the test database loads hold none. The full CoFID import has one, so that part holds only on a database that has run it.

## Reviewer's sample

To be filled in by the reviewer, independently of the engineer: every McDonald's burger, every KFC burger and a random 20% of the rest, at least 3 per chain, each re-read from its source and compared with the CSV. For Nando's, the reviewer re-reads the kcal of at least 3 items from the menu page and checks the estimate of one item by hand from `nandos-estimates.json` and CoFID.

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
| mcdonalds-gb:big-mac | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 509 | none | Yes |
| mcdonalds-gb:quarter-pounder-with-cheese | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 514 | none | Yes |
| mcdonalds-gb:double-quarter-pounder-with-cheese | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 749 | none | Yes |
| mcdonalds-gb:cheeseburger | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 303 | none | Yes |
| mcdonalds-gb:hamburger | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 255 | none | Yes |
| mcdonalds-gb:double-cheeseburger | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 452 | none | Yes |
| mcdonalds-gb:mcchicken-sandwich | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 371 | none | Yes |
| mcdonalds-gb:filet-o-fish | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 316 | none | Yes |
| mcdonalds-gb:mccrispy | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 484 | none | Yes |
| mcdonalds-gb:chicken-mcnuggets-6 | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 261 | none | Yes |
| mcdonalds-gb:chicken-mcnuggets-9 | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 391 | none | Yes |
| mcdonalds-gb:fries-small | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 237 | none | Yes |
| mcdonalds-gb:fries-medium | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 337 | none | Yes |
| mcdonalds-gb:fries-large | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 444 | none | Yes |
| mcdonalds-gb:sausage-egg-mcmuffin | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 424 | none | Yes |
| mcdonalds-gb:bacon-egg-mcmuffin | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 336 | none | Yes |
| mcdonalds-gb:hash-brown | Orchestrator's browser reading of the product page table (reviewer cannot fetch the 403 site), all nine fields compared with the CSV | 127 | none | Yes |
| kfc-gb:zinger-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 468 | none | Yes |
| kfc-gb:fillet-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 463 | none | Yes |
| kfc-gb:zinger-supercharger-tower-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 652 | none | Yes |
| kfc-gb:fillet-tower-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 604 | none | Yes |
| kfc-gb:zinger-stacker-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 813 | none | Yes |
| kfc-gb:mini-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 277 | none | Yes |
| kfc-gb:vegan-burger | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 396 | none | Yes |
| kfc-gb:kentucky-mayo-twister | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 520 | none | Yes |
| kfc-gb:sweet-chilli-twister | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 492 | none | Yes |
| kfc-gb:smokey-bbq-twister | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 482 | none | Yes |
| kfc-gb:supercharger-twister | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 548 | none | Yes |
| kfc-gb:original-recipe-chicken | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 241 | none | Yes |
| kfc-gb:tender | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 125 | none | Yes |
| kfc-gb:regular-popcorn-chicken | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 307 | none | Yes |
| kfc-gb:regular-signature-fries | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 261 | none | Yes |
| kfc-gb:large-signature-fries | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 372 | none | Yes |
| kfc-gb:hash-brown | KFC UK Nov 2026 PDF re-read by the reviewer, kJ, kcal and all seven nutrients per item, no weight, fibre blank | 92 | none | Yes |
| nandos-gb:quarter-chicken | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 289 | none | Yes |
| nandos-gb:whole-chicken | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 1159 | none | Yes |
| nandos-gb:chicken-butterfly | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 332 | none | Yes |
| nandos-gb:3-chicken-wings | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 236 | none | Yes |
| nandos-gb:5-chicken-wings | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 393 | none | Yes |
| nandos-gb:10-chicken-wings | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 786 | none | Yes |
| nandos-gb:grilled-chicken-wrap | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 514 | none | Yes |
| nandos-gb:grilled-chicken-pitta | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 508 | none | Yes |
| nandos-gb:regular-peri-salted-chips | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 498 | none | Yes |
| nandos-gb:regular-spicy-rice | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 246 | none | Yes |
| nandos-gb:regular-macho-peas | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 155 | none | Yes |
| nandos-gb:regular-corn-on-the-cob | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 142 | none | Yes |
| nandos-gb:regular-garlic-bread | Nando's UK menu page re-read by the reviewer on 2026-11-11, kcal only (no macros published), "From" read as the regular size | 372 | none | Yes |

Nando's estimate hand-checked by the reviewer: nandos-gb:quarter-chicken (75 g grilled breast 18-325, 62.5 g roast leg 18-337, 3 g rapeseed oil 17-041, 0.8 g salt 17-367 sum to 304.2 kcal, factor 0.9500, giving 33.0 g protein, 17.4 g fat, 3.6 g saturates, 1.0 g salt as stored) and nandos-gb:chicken-butterfly (factor 1.0069, giving 50.9 g protein, 14.3 g fat, 1.8 g saturates, 1.26 g salt as stored). Both match the CSV.
