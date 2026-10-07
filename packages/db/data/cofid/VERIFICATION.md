# CoFID import verification

This is the written record that the CoFID import maps the published workbook correctly. It covers where the data came from, what the workbook looks like, how it becomes the normalised CSV, every mapping decision, and ten foods checked against the published values.

## Provenance

- Dataset: McCance and Widdowson's The Composition of Foods Integrated Dataset 2021 (published 19 March 2021)
- Publication page: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid (the same URL core's `DATA_SOURCE_ATTRIBUTION.cofid` uses)
- File URL: https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx
- User guide: https://assets.publishing.service.gov.uk/media/60538e66d3bf7f03249bac58/McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.pdf
- Download date: 2026-10-07
- xlsx sha256: `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d` (checked again with `shasum -a 256` before the import was built)
- Normalised CSV sha256: `0a176228e2a4e93971614b6e1985a6b68cf992ac4885fcdb354f45d7a32e8c51`
- Licence: Open Government Licence v3
- Sheets: List of tables, 1.1 Notes, 1.2 Factors, 1.3 Proximates, 1.4 Inorganics, 1.5 Vitamins, 1.6 Vitamin Fractions, 1.7 to 1.12 fatty acid tables, 1.13 Phytosterols, 1.14 Organic Acids

## Licence and attribution

CoFID is published under the Open Government Licence v3.0. The attribution text the apps must show wherever CoFID data appears is the one in `@keylow/core` (`DATA_SOURCE_ATTRIBUTION.cofid`):

> Contains public sector information licensed under the Open Government Licence v3.0. Source: McCance and Widdowson's The Composition of Foods Integrated Dataset, Public Health England and the Office for Health Improvement and Disparities.

## Files in this directory

| File                               | Committed | What it is                                                     |
| ---------------------------------- | --------- | -------------------------------------------------------------- |
| `cofid-2021.xlsx`                  | No        | The workbook, 4.6 MB. Git ignores `data/cofid/*.xlsx`.         |
| `cofid-2021.normalised.csv`        | Yes       | The sheets joined into one wide CSV, 2.0 MB (2,016,915 bytes). |
| `cofid-2021.normalised.csv.sha256` | Yes       | The CSV's sha256 in the format `shasum -a 256 -c` reads.       |
| `VERIFICATION.md`                  | Yes       | This record.                                                   |

To reproduce the CSV from the workbook, put the workbook at `packages/db/data/cofid/cofid-2021.xlsx` and run, from the repository root:

```sh
pnpm --filter @keylow/db import:cofid normalise --xlsx data/cofid/cofid-2021.xlsx
cd packages/db/data/cofid && shasum -a 256 -c cofid-2021.normalised.csv.sha256
```

The normalise stage was run twice and gave byte-identical files, so the hash above is reproducible. The import stage checks a CSV against its `.sha256` file when one sits next to it, and refuses a CSV that has been edited.

## What the workbook looks like

I read every sheet before designing the CSV. The findings that the mapping depends on:

- Sheet `1.1 Notes` carries the data conventions. Three of them bind the mapping. The first says nutrient values are "expressed per 100g of the food except in the case of alcoholic beverages which are presented per 100ml". The second says "a trace value for a nutrient is represented by Tr". The third says "where a nutrient is present in significant quantities, but there is no reliable information on the amount, the value is represented by N".
- Sheets `1.2` to `1.14` each list the same 2,887 foods in the same order. Row 1 holds the header with its unit (for example `Sodium (mg)`), row 2 holds a short tag (for example `NA`), row 3 holds a description, and the data starts on row 4. Sheet `1.2 Factors` has no tag or description rows and its data also starts on row 4.
- Columns A to G of every sheet are the same seven identity columns: `Food Code`, `Food Name`, `Description`, `Group`, `Previous`, `Main data references`, `Footnote`. Sheet `1.4 Inorganics` leaves the header of column A blank (it holds a single space), so the code column is identified by position.
- Data columns start at column H. Cells are text or numbers. Numbers are stored as text in most cells and as true numbers in 16,097 of them, which is why the CSV holds the cell's shortest decimal text.
- Energy is in sheet `1.3 Proximates`, column M `Energy (kcal) (kcal)` (tag `KCALS`), next to column N `Energy (kJ) (kJ)` (tag `KJ`).
- Fibre is also in `1.3 Proximates`: column Y `NSP (g)` (tag `ENGFIB`, "Non-starch polysaccharide", the Englyst method) and column Z `AOAC fibre (g)` (tag `AOACFIB`).
- Sodium is in `1.4 Inorganics`, column H `Sodium (mg)` (tag `NA`).
- Saturated fat per 100 g of food is in `1.3 Proximates`, column AB `Satd FA /100g fd (g)` (tag `SATFOD`). Total sugars is column Q `Total sugars (g)` (tag `TOTSUG`). Protein, fat and carbohydrate are columns J, K and L.
- The food group is a code such as `DG`, `BN` or `QE`. The workbook has no legend that turns the codes into names.

## The normalised CSV

One row per food (2,887 rows) and 287 columns, sorted by food code (numbers compared as numbers, ties by name), columns in a fixed order, `\n` line endings, no trailing whitespace, a field quoted only when it needs it.

The first seven columns are the identity columns, named `food_code`, `food_name`, `description`, `food_group`, `previous_code`, `main_data_references` and `footnote`. They come from sheet `1.3 Proximates`. The other 280 columns are the data columns of the thirteen data sheets, each named `<sheet slug>_<header>`. The header is the sheet's row 1 text lower-cased, the micro sign written as `u`, and every run of other characters collapsed to one underscore. So `Sodium (mg)` on `1.4 Inorganics` is `inorganics_sodium_mg`, `Retinol (µg)` on `1.5 Vitamins` is `vitamins_retinol_ug`, and `Energy (kcal) (kcal)` on `1.3 Proximates` is `proximates_energy_kcal_kcal`. Headers are kept as published, so the typo in `5-mehtyl folate (µg)` survives as `vitamin_fractions_5_mehtyl_folate_ug`. Two headers that would get the same name make the stage fail.

| Sheet                    | Slug                | Data columns |
| ------------------------ | ------------------- | ------------ |
| 1.2 Factors              | `factors`           | 5            |
| 1.3 Proximates           | `proximates`        | 40           |
| 1.4 Inorganics           | `inorganics`        | 12           |
| 1.5 Vitamins             | `vitamins`          | 17           |
| 1.6 Vitamin Fractions    | `vitamin_fractions` | 18           |
| 1.7 (SFA per 100gFA)     | `sfa_fa`            | 27           |
| 1.8 (SFA per 100gFood)   | `sfa_food`          | 27           |
| 1.9 (MUFA per 100FA)     | `mufa_fa`           | 25           |
| 1.10 (MUFA per 100gFood) | `mufa_food`         | 25           |
| 1.11 (PUFA per 100gFA)   | `pufa_fa`           | 36           |
| 1.12 (PUFA per 100gFood) | `pufa_food`         | 36           |
| 1.13 Phytosterols        | `phytosterols`      | 10           |
| 1.14 Organic Acids       | `organic_acids`     | 2            |

The sheets are joined on the food code. A code that appears twice is paired by order of appearance, and every pairing is checked against the food name. A sheet that lacks a food, holds an extra one, or names it differently makes the stage fail. The CSV file name carries the version of the workbook (`cofid-2021`), taken from the workbook's file name.

Cell text is trimmed. Whitespace around cells appears widely in the identity columns (the `Previous` column of sheet 1.3 has a trailing space on 1,713 foods), and no data cell needed it. Line breaks inside a cell become `\n`.

### Cell values in the workbook

Every data cell of the thirteen sheets was classified. The grammar is a number, `Tr`, `N` or blank, and anything else is refused by both stages rather than coerced.

| Kind                         | Cells   |
| ---------------------------- | ------- |
| Numbers (plain or bracketed) | 198,146 |
| `Tr`                         | 30,226  |
| `N`                          | 11,967  |
| Blank                        | 568,020 |
| Negative number              | 1       |
| Anything else                | 0       |

Two kinds of cell needed a decision, because they are neither a number, `Tr`, `N` nor blank.

- **Numbers in brackets: 14 cells, all in sheet 1.8 (saturated fatty acids per 100 g of food), on two foods.** Food 12-184 has 13 of them (`C4:0` to `C24:0`) and food 17-789 has one (`C10:0`, `(0.07)`). Neither food is among the ten spot checks, and none is in a column the mapping reads by name. The workbook does not say what the brackets mean. Decision: read the number inside, store it in `micros`, and keep the bracketed text unchanged in `food_source_data.raw`. A unit test covers it with the literal `(0.07)`.
- **A negative number: 1 cell, `-0.01`, in sheet 1.7 (food 18-095, `C8:0 /100g FA (g)`).** No food holds a negative amount, and the database refuses a negative nutrient. Decision: treat it as no value, which means it is left out of `micros`, and keep `-0.01` unchanged in `raw`. If a headline column ever held one, it would be null and listed in `fields_missing` like an `N`.

## Mapping decisions

Each decision names its source. ADR means `docs/adr/0003-data-model.md` with Amendment 1, and KEY-44 is the ticket.

| Rule                       | Decision                                                                                                                                                                                                                                                                                                                                                    | Source                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Identity                   | `source` is `cofid`. `source_ref` is the food code. `name` is the food name as published, trimmed. `food_group` is the group code as published (null if blank). `brand`, `barcode`, `owner_id` and `density_g_per_ml` are null.                                                                                                                             | ADR, KEY-44, the migration's check constraints |
| `fetched_at`               | Null. The migration's check `(source = 'off') = (fetched_at is not null)` allows a value only on OFF rows.                                                                                                                                                                                                                                                  | `20261007011849_foods.sql`                     |
| Basis                      | `per_100g` for every food, except the 31 foods whose group code starts with `Q`, which are `per_100ml`. Sheet 1.1 says alcoholic beverages are given per 100 ml. The `Q` groups are the beer, cider, wine, fortified wine, vermouth, liqueur, spirit and pre-mixed drink groups (`QA` to `QK` and `Q`), so the prefix picks out exactly those.              | ADR (basis enum), sheet 1.1                    |
| Energy                     | `kcal` is the `Energy (kcal) (kcal)` column. It is never derived from kJ, even when kcal is `N` and kJ is a number (that never happens in this workbook). `kcal_derived` is never set. The kJ column goes to `micros`.                                                                                                                                      | ADR, KEY-44                                    |
| Protein, fat, carbohydrate | The `Protein (g)`, `Fat (g)` and `Carbohydrate (g)` columns. The ADR stores carbohydrate EU-style, and the CoFID carbohydrate column is the one published.                                                                                                                                                                                                  | ADR, KEY-44                                    |
| Sugars, saturated fat      | `sugars_g` is `Total sugars (g)`. `sat_fat_g` is `Satd FA /100g fd (g)`, which is per 100 g of food, not the per 100 g of fatty acids column next to it.                                                                                                                                                                                                    | KEY-44 (per 100 g)                             |
| Salt                       | `salt_g = sodium_mg × 2.5 / 1000`, rounded to six decimal places so floating point noise never reaches the database. Sodium is not also copied into `micros`.                                                                                                                                                                                               | ADR                                            |
| Fibre                      | AOAC fibre where the AOAC cell has a value (a number or `Tr`), otherwise the Englyst (NSP) value. `quality.fibre_method` is `aoac` or `englyst`. With neither, `fibre_g` is null and `fibre_method` is absent. Neither fibre column is repeated in `micros`.                                                                                                | ADR                                            |
| `Tr`                       | Becomes 0. The field is listed in `quality.trace_fields`, by the food field it fills (`protein_g`, `fibre_g`, `salt_g` for a trace of sodium) or, for a micronutrient, by its CSV column name. Fixed fields come first, then micros in column order.                                                                                                        | ADR                                            |
| `N` and blank              | Become null. A micronutrient that is null is left out of `micros`, so `{}` means none recorded.                                                                                                                                                                                                                                                             | ADR                                            |
| `fields_missing`           | Lists each of the five headline fields (`kcal`, `protein_g`, `fat_g`, `carbs_g`, `fibre_g`) that is null, whether the cell was `N` or blank, in that order.                                                                                                                                                                                                 | KEY-44, `foodQualitySchema`                    |
| `suspect`                  | True when `kcal`, `protein_g`, `fat_g` or `carbs_g` is null. That is the same four-macro rule OFF foods use (`listMissingMacros` in core), so the review gate behaves identically for both sources. A missing fibre alone lists `fibre_g` in `fields_missing` and does not make the food suspect.                                                           | ADR (frozen `quality` list), core              |
| Micros                     | Every nutrient column of sheets 1.3 to 1.14 that has no column of its own, keyed by its CSV column name, as a number. That includes water, starch, the individual sugars, kJ, cholesterol, the minerals, the vitamins, all the fatty acid tables, phytosterols and organic acids. The factors in sheet 1.2 are not nutrient amounts and stay in `raw` only. | ADR                                            |
| Raw                        | `food_source_data.raw` is the whole joined row, every CSV column, with the cell text unchanged (`Tr`, `N`, `(0.07)`, `-0.01`) and blank cells as null.                                                                                                                                                                                                      | ADR                                            |
| Quality                    | Built with only the notable keys, so a food with nothing notable is `{}`, then parsed through `foodQualitySchema` before it is written.                                                                                                                                                                                                                     | core                                           |
| Duplicate food code        | See below. Every food with such a code is skipped, listed in the output, and counted in the import's summary.                                                                                                                                                                                                                                               | Unique `(source, source_ref)`                  |

### Things found in the workbook that were not in the brief

- **Known erratum in the workbook: the code `13-669` appears twice.** Sheet 1.3 row 55 is "Aubergine, flesh and skin, roasted in rapeseed oil" and row 2827 is "Watercress, raw" (previous code `13-653`). The same pairing holds in every sheet. One of the two carries a wrong code, but nothing in the workbook says which. `(source, source_ref)` is unique, so only one could be stored, and choosing would be a guess. Decision: the normalised CSV keeps both rows, and the import skips both and logs it, so 2,885 of the 2,887 foods are imported and neither the aubergine nor the watercress is searchable. A follow-up ticket will correct the code once it is known. A `--subset` file that names `13-669` is an error.
- **Four cells repeat an identity cell with different text across sheets.** Food 13-333 has the description `Literature sources;` in sheet 1.3 and `Literature sources` in sheet 1.2. Food 18-510 and food 18-531 have no description in sheet 1.9. Food 18-524 has a different main data reference in sheet 1.4 (`LGC, Nutrient analysis of retail cuts of pork, 1992-1993` instead of the `QIB` 2020 report). The identity columns come from sheet 1.3, so those four differences are reported by the normalise stage and otherwise ignored.
- **Specific gravity is given for 54 foods** (the alcoholic drinks, and many dairy and frozen dessert foods such as milk, cream, yoghurt and ice cream). `density_g_per_ml` is left null for every food and the value stays in `raw` as `factors_specific_gravity`, because the mapping paragraph does not say to use it and the dairy foods are per 100 g.
- **`Coffee, Irish` (group `PAC`) contains alcohol but is not an alcoholic beverage group**, so it is per 100 g. Sheet 1.1 speaks of alcoholic beverages, and I took that to mean the `Q` groups.
- **One footnote mentions per 100 ml.** The footnote of `Lassi, sweetened` (12-373, group `BN`) quotes the composition of Yakult per 100 ml. It describes another product and not the lassi's own columns, so the lassi stays per 100 g like the other dairy foods. It is recorded here and not acted on.
- **The food group is a code without a legend.** `food_group` holds the code (`DG`, `BN`, `QE` and so on). Turning codes into display names needs a legend that is not in the workbook.

## Import record

The full import ran once into the shared local database:

- Label: `local-full-2021`
- Import run id: `2c851891-c52d-48a1-880c-66265cb13cb1`
- Foods written: 2,885 (`foods` and `food_source_data` both have 2,885 `cofid` rows)
- Duration: 1.9 s for the import (2.8 s for the whole command), in batches of 100 foods
- `import_runs.file_sha256`: `0a176228e2a4e93971614b6e1985a6b68cf992ac4885fcdb354f45d7a32e8c51`, `row_count` 2885, `finished_at` set
- A run that fails part way keeps the `row_count` of the batches already written and leaves `finished_at` null, so `finished_at is null` is the one reliable marker of an incomplete run. The failure is then rethrown and the command exits non-zero.
- Size on disk: `foods` 13 MB, `food_source_data` 9.2 MB

What the imported foods look like:

| Measure                                                     | Foods         |
| ----------------------------------------------------------- | ------------- |
| `basis = per_100ml` (all in `Q` groups)                     | 31            |
| `fibre_method = aoac`                                       | 1,546         |
| `fibre_method = englyst`                                    | 1,092         |
| No fibre value (`fibre_g` null, listed in `fields_missing`) | 247           |
| `quality.suspect` (a null headline macro)                   | 34            |
| `kcal` null / `carbs_g` null                                | 33 / 34       |
| `sugars_g` null / `sat_fat_g` null / `salt_g` null          | 98 / 276 / 43 |

Each food holds on average 69 micros (about 2.2 kB of JSON, at most 7.6 kB), 10 trace fields, and about 10.5 kB of `raw`.

## Spot checks

The published values below were read straight from the workbook cells by a separate script that does not share code with the import, then compared with the rows in the database. Fibre is the AOAC cell when it has a value and otherwise the NSP cell. Salt is the published sodium in mg × 2.5 / 1000. "Pub" is the workbook cell and "DB" is the imported value.

| Code   | Food                                              | kcal pub / DB | Protein pub / DB | Fat pub / DB | Carbs pub / DB | Fibre pub / DB | Sodium pub, salt DB | Match |
| ------ | ------------------------------------------------- | ------------- | ---------------- | ------------ | -------------- | -------------- | ------------------- | ----- |
| 18-323 | Chicken, breast, grilled without skin, meat only  | 148 / 148     | 32.0 / 32        | 2.2 / 2.2    | 0.0 / 0        | AOAC 0.0 / 0   | 55 mg, 0.1375 g     | Yes   |
| 12-555 | Yogurt, Greek style, plain                        | 133 / 133     | 5.7 / 5.7        | 10.2 / 10.2  | 4.8 / 4.8      | AOAC 0.0 / 0   | 66 mg, 0.165 g      | Yes   |
| 12-313 | Milk, semi-skimmed, pasteurised, average          | 46 / 46       | 3.5 / 3.5        | 1.7 / 1.7    | 4.7 / 4.7      | AOAC 0.0 / 0   | 43 mg, 0.1075 g     | Yes   |
| 17-038 | Oil, olive                                        | 899 / 899     | Tr / 0           | 99.9 / 99.9  | 0.0 / 0        | AOAC 0.0 / 0   | Tr, 0 g             | Yes   |
| 11-981 | Bread, wholemeal, average                         | 217 / 217     | 9.4 / 9.4        | 2.5 / 2.5    | 42.0 / 42      | AOAC 7.0 / 7   | 400 mg, 1 g         | Yes   |
| 14-318 | Bananas, flesh only                               | 81 / 81       | 1.2 / 1.2        | 0.1 / 0.1    | 20.3 / 20.3    | AOAC 1.4 / 1.4 | Tr, 0 g             | Yes   |
| 12-937 | Eggs, chicken, whole, raw                         | 131 / 131     | 12.6 / 12.6      | 9.0 / 9      | Tr / 0         | AOAC 0.0 / 0   | 154 mg, 0.385 g     | Yes   |
| 11-862 | Rice, white, long grain, boiled in unsalted water | 131 / 131     | 2.8 / 2.8        | 0.4 / 0.4    | 31.1 / 31.1    | AOAC 0.5 / 0.5 | 11 mg, 0.0275 g     | Yes   |
| 11-788 | Porridge oats, unfortified                        | 381 / 381     | 10.9 / 10.9      | 8.1 / 8.1    | 70.7 / 70.7    | AOAC 7.8 / 7.8 | 1 mg, 0.0025 g      | Yes   |
| 12-346 | Cheese, Cheddar, English                          | 416 / 416     | 25.4 / 25.4      | 34.9 / 34.9  | 0.1 / 0.1      | AOAC 0.0 / 0   | 723 mg, 1.8075 g    | Yes   |

Ten of ten match. Four more foods cover the edge cases of the mapping:

| Code   | Food                                                    | What it exercises                       | Published                                          | Imported                                                                                              | Match |
| ------ | ------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| 17-752 | Wine, red                                               | Alcoholic beverage, per 100 ml          | 76 kcal, 0.1 protein, 0.0 fat, 0.2 carbs, sodium 7 | `per_100ml`, 76, 0.1, 0, 0.2, salt 0.0175                                                             | Yes   |
| 13-801 | Allspice, ground                                        | `N` in kcal, carbohydrate and fibre     | kcal N, protein 6.1, fat 8.7, carbs N, NSP N       | kcal, `carbs_g` and `fibre_g` null, `quality` is suspect with `fields_missing` kcal, carbs_g, fibre_g | Yes   |
| 11-716 | Pasta, white, dried, raw                                | Englyst fibre where AOAC is blank       | 343 kcal, 75.6 carbs, AOAC blank, NSP 3.7          | `fibre_g` 3.7, `fibre_method` englyst                                                                 | Yes   |
| 16-015 | Cod, flesh only, poached in milk, butter and salt added | `Tr` carbohydrate, Englyst fibre of 0.0 | carbs Tr, NSP 0.0                                  | `carbs_g` 0, `trace_fields` includes carbs_g, `fibre_g` 0, `fibre_method` englyst                     | Yes   |

### Search ranking

`select name, score from public.search_foods('chicken breast', 10)`, run as an authenticated user against the full local import:

| Score    | Source | Code   | Name                                                          |
| -------- | ------ | ------ | ------------------------------------------------------------- |
| 2.1      | cofid  | 18-504 | Chicken breast/steak, coated, baked                           |
| 2.1      | cofid  | 18-308 | Chicken, breast, casseroled, meat and skin                    |
| 2.1      | cofid  | 18-309 | Chicken, breast, casseroled, meat and skin, weighed with bone |
| 2.1      | cofid  | 18-307 | Chicken, breast, casseroled, meat only                        |
| 2.1      | cofid  | 18-324 | Chicken, breast, grilled with skin, meat only                 |
| 2.1      | cofid  | 18-323 | Chicken, breast, grilled without skin, meat only              |
| 2.1      | cofid  | 18-325 | Chicken, breast, grilled, meat and skin                       |
| 2.1      | cofid  | 18-326 | Chicken, breast, strips, stir-fried in corn oil               |
| 0.805882 | cofid  | 11-964 | Sandwich, white bread, chicken salad                          |
| 0.7      | cofid  | 19-449 | Curry, chicken balti, retail                                  |

A CoFID chicken breast row ranks first, so the M2 criterion holds as worded. Eight chicken breast rows tie on the score, and the first of them is a coated product. CoFID has no raw chicken breast row.

## Decisions accepted as built, and follow-ups

Each of these was a judgement call that the ADR and the ticket leave open. They are accepted as described above.

- `density_g_per_ml` is null for every food. Specific gravity (54 foods) stays in `raw` as `factors_specific_gravity`. Using it for the per 100 ml foods is a follow-up.
- `food_group` holds the published group code. Display names need a legend that the workbook does not have.
- `quality.suspect` is true when `kcal`, `protein_g`, `fat_g` or `carbs_g` is null. A missing fibre value alone lists `fibre_g` in `fields_missing` and does not make the food suspect.
- `micros` holds every nutrient column that has no column of its own, including the per 100 g of fatty acids tables, so it averages 69 keys and 2.2 kB per food.
- Numbers in brackets are read as numbers and kept verbatim in `raw`. The one negative value is left out of `micros` and kept verbatim in `raw`.
- Food groups whose code starts with `Q` are `per_100ml`.
- `--emit-sql` is not implemented. KEY-48 can add it as another implementation of the `ImportStore` type in `scripts/cofid/importFoods.ts`, which already separates mapping from writing.
- Node cannot load `@keylow/core` directly because its imports have no file extensions, so `pnpm --filter @keylow/db import:cofid` runs the script through `scripts/run-typescript.ts`, a small esbuild launcher that bundles the script and core into `node_modules/.cache` (git ignored).
