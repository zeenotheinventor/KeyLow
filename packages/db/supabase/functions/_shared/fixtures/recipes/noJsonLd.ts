// A made-up recipe page for the tests. The text is original, not copied from any real site.
// No JSON-LD, so a reader has only the visible text. It carries a script, a style block, a comment,
// a navigation bar and a cookie banner that is hidden.
export const noJsonLdPage = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <title>Slow Cooker Lentil Soup | Example Kitchen</title>
    <style>.banner { display: none; }</style>
    <script>window.tracking = "do not show this";</script>
  </head>
  <body>
    <nav><a href="/">Home</a> <a href="/recipes">Recipes</a></nav>
    <!-- a comment that nobody should read -->
    <div class="banner" style="display: none">We use cookies.</div>
    <main>
      <h1>Slow Cooker Lentil Soup</h1>
      <p>Makes 6 bowls. Ready in <strong>6 hours</strong>.</p>
      <h2>Ingredients</h2>
      <ul>
        <li>300 g green lentils</li>
        <li>1 large onion, chopped</li>
        <li>1 litre vegetable stock</li>
      </ul>
      <h2>Method</h2>
      <ol>
        <li>Put everything in the slow cooker.</li>
        <li>Cook on low for 6 hours.</li>
      </ol>
    </main>
  </body>
</html>
`;
