// A made-up recipe page for the tests. The text is original, not copied from any real site.
// The Recipe sits inside an @graph next to other nodes, a second Recipe follows it, and an
// earlier script block holds an array that has no Recipe.
export const jsonLdGraphPage = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      [{ "@context": "https://schema.org", "@type": "Organization", "name": "Example Kitchen" }]
    </script>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "name": "Example Kitchen" },
          { "@type": ["Article", "BlogPosting"], "headline": "A cosy supper" },
          {
            "@type": ["Recipe"],
            "name": "Red Lentil Dal",
            "recipeYield": 2,
            "recipeIngredient": ["200 g red lentils", "1 tsp ground turmeric", "400 ml water"],
            "recipeInstructions": [
              { "@type": "HowToStep", "name": "Simmer", "text": "Simmer the lentils with the turmeric in the water for 20 minutes." }
            ]
          },
          {
            "@type": "Recipe",
            "name": "A second recipe that must be ignored",
            "recipeIngredient": ["1 egg"],
            "recipeInstructions": ["Boil it."]
          }
        ]
      }
    </script>
  </head>
  <body></body>
</html>
`;
