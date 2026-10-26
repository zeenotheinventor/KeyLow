// A made-up recipe page for the tests. The text is original, not copied from any real site.
// The steps come in two HowToSection groups followed by one loose step. The ingredients use
// numeric and named fraction entities.
export const jsonLdHowToSectionPage = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Small Buttermilk Pancakes",
        "recipeYield": "Makes 12 small pancakes",
        "recipeIngredient": [
          "150 g plain flour",
          "&#189; tsp bicarbonate of soda",
          "&frac14; tsp fine salt",
          "200 ml buttermilk"
        ],
        "recipeInstructions": [
          {
            "@type": "HowToSection",
            "name": "Make the batter",
            "itemListElement": [
              { "@type": "HowToStep", "text": "Whisk the dry ingredients together." },
              { "@type": "HowToStep", "text": "Stir in the buttermilk until just combined." }
            ]
          },
          {
            "@type": "HowToSection",
            "name": "Cook",
            "itemListElement": [
              { "@type": "HowToStep", "text": "Fry spoonfuls in a hot pan until bubbles show." },
              { "@type": "HowToStep", "text": "Flip and cook for one more minute." }
            ]
          },
          { "@type": "HowToStep", "text": "Serve warm." }
        ]
      }
    </script>
  </head>
  <body></body>
</html>
`;
