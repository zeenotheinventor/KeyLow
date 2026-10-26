// A made-up recipe page for the tests. The text is original, not copied from any real site.
// The JSON-LD block is cut off part-way through, so it cannot be parsed.
export const jsonLdMalformedPage = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Broken Soup",
        "recipeIngredient": ["1 onion", "2 carrots",
    </script>
  </head>
  <body><h1>Broken Soup</h1></body>
</html>
`;
