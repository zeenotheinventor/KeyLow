// A made-up recipe page for the tests. The text is original, not copied from any real site.
// The JSON-LD holds the whole recipe, and the last ingredient is a vague amount of a food the database
// holds ("a splash of milk"), which the import has to guess. `lemonTraybakeWithWinePage` swaps that line
// for a vague amount of a food the test database does not hold.
const page = (lastIngredient: string) => `<!doctype html>
<html lang="en-GB">
  <head>
    <title>Lemon chicken traybake | Example Kitchen</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Lemon chicken traybake",
        "recipeYield": "4 servings",
        "recipeIngredient": [
          "800 g chicken thighs, skinless",
          "750 g new potatoes",
          "2 tbsp olive oil",
          "1 lemon",
          "4 garlic cloves",
          "${lastIngredient}"
        ],
        "recipeInstructions": [
          { "@type": "HowToStep", "text": "Heat the oven to 200C." },
          { "@type": "HowToStep", "text": "Toss everything in the oil and roast for 45 minutes." }
        ]
      }
    </script>
  </head>
  <body><h1>Lemon chicken traybake</h1></body>
</html>
`;

export const lemonTraybakePage = page("A splash of milk");
export const lemonTraybakeWithWinePage = page("A splash of white wine");
