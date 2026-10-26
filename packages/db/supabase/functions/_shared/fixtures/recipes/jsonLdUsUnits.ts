// A made-up recipe page for the tests. The text is original, not copied from any real site.
// US units, a yield given as a sentence, and the steps given as one string with line breaks.
export const jsonLdUsUnitsPage = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Recipe","name":"Weeknight Black Bean Chilli",
     "recipeYield":"Serves 6",
     "recipeIngredient":["1 lb ground turkey","2 cups canned black beans, drained",
       "1 (14.5 oz) can diced tomatoes","1/2 cup chopped onion","3 tablespoons chili powder"],
     "recipeInstructions":"Brown the turkey in a large pot over medium heat for 8 minutes.\\nAdd the onion and cook until soft.\\r\\n\\nStir in the beans, tomatoes and chili powder, then simmer for 25 minutes."}
    </script>
  </head>
  <body><h1>Weeknight Black Bean Chilli</h1></body>
</html>
`;
