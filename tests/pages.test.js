const assert = require("assert");
const { pathToSlug, isNavConfig, collectPageChanges, renderComment, MARKER } = require("../lib/pages.js");

// slug mapping, root docs
assert.strictEqual(pathToSlug("quickstart.mdx", "."), "quickstart");
assert.strictEqual(pathToSlug("index.mdx", "."), "");
assert.strictEqual(pathToSlug("guides/index.mdx", "."), "guides");
assert.strictEqual(pathToSlug("api-reference/auth/tokens.md", "."), "api-reference/auth/tokens");
assert.strictEqual(pathToSlug("README.md", "."), "README");           // real file, real slug
assert.strictEqual(pathToSlug("src/index.ts", "."), null);            // not a page
assert.strictEqual(pathToSlug("images/logo.png", "."), null);
// slug mapping, nested docs folder
assert.strictEqual(pathToSlug("docs/quickstart.mdx", "docs"), "quickstart");
assert.strictEqual(pathToSlug("docs/index.mdx", "docs/"), "");
assert.strictEqual(pathToSlug("quickstart.mdx", "docs"), null);       // outside docs folder
assert.strictEqual(pathToSlug("docs\\win\\path.mdx", "docs"), "win/path");
// nav config
assert.ok(isNavConfig("docs.json", "."));
assert.ok(isNavConfig("docs/docs.json", "docs"));
assert.ok(isNavConfig("mint.json", "."));
assert.ok(!isNavConfig("package.json", "."));
// end to end
const files = [
  { filename: "docs/intro.mdx", status: "modified" },
  { filename: "docs/new/page.mdx", status: "added" },
  { filename: "docs/old.mdx", status: "removed" },
  { filename: "docs/docs.json", status: "modified" },
  { filename: "src/thing.ts", status: "modified" },
];
const r = collectPageChanges(files, "docs", "https://proj-branch.mintlify.app/");
assert.strictEqual(r.navChanged, true);
assert.deepStrictEqual(r.pages.map(p => p.slug), ["intro", "new/page", "old"]);
assert.strictEqual(r.pages[1].url, "https://proj-branch.mintlify.app/new/page");
const body = renderComment(r.pages, r.navChanged, "https://proj-branch.mintlify.app");
assert.ok(body.startsWith(MARKER));
assert.ok(body.includes("| `old` | removed | — |"));
assert.ok(body.includes("[open](https://proj-branch.mintlify.app/new/page)"));
assert.ok(body.includes("Navigation config"));
// empty
const e = renderComment([], false, "https://x.mintlify.app");
assert.ok(e.includes("No `.mdx`"));
console.log("all tests passed");
