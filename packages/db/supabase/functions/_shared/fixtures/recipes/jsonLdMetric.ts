// A made-up recipe page for the tests. The text is original, not copied from any real site.
// Metric units, a yield given as an array, entities and stray whitespace inside the JSON-LD.
export const jsonLdMetricPage = `<!doctype html>
<html lang="en-GB">
  <head>
    <title>Lemon and Thyme Chicken Traybake</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "  Lemon &amp; Thyme   Chicken Traybake ",
        "recipeYield": ["4", "4 servings"],
        "recipeIngredient": [
          "800 g chicken thighs, bone in",
          "2 tbsp olive oil",
          "1 lemon, zest and juice",
          "  4   sprigs thyme ",
          "500 g baby potatoes, halved",
          "250 ml chicken stock",
          "salt &amp; black pepper, to taste"
        ],
        "recipeInstructions": [
          { "@type": "HowToStep", "text": "Heat the oven to 200&deg;C (180&deg;C fan)." },
          { "@type": "HowToStep", "text": "Toss the potatoes and chicken in the oil, lemon and thyme." },
          { "@type": "HowToStep", "text": "Pour in the stock and roast for 45 minutes." }
        ]
      }
    </script>
  </head>
  <body>
    <h1>Lemon and Thyme Chicken Traybake</h1>
    <p>Serves 4.</p>
  </body>
</html>
`;
