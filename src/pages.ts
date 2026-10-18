export type ChangeStatus = "added" | "modified" | "removed" | "renamed";

export interface ChangedFile {
  filename: string;
  status: ChangeStatus | string;
  previous_filename?: string;
}

export interface PageChange {
  path: string;
  slug: string;
  status: ChangeStatus;
  url: string;
}

const PAGE_EXT = /\.(mdx|md)$/i;

/** Normalize a docs path to the slug Mintlify serves it at. */
export function pathToSlug(filename: string, docsPath: string): string | null {
  let rel = filename.replace(/\\/g, "/");
  const root = docsPath.replace(/^\.\/?/, "").replace(/\/+$/, "");
  if (root && root !== ".") {
    if (!rel.startsWith(root + "/")) return null;
    rel = rel.slice(root.length + 1);
  }
  if (!PAGE_EXT.test(rel)) return null;
  rel = rel.replace(PAGE_EXT, "");
  // index.mdx at any level resolves to its folder
  if (rel === "index") return "";
  if (rel.endsWith("/index")) rel = rel.slice(0, -"/index".length);
  return rel;
}

export function isNavConfig(filename: string, docsPath: string): boolean {
  const root = docsPath.replace(/^\.\/?/, "").replace(/\/+$/, "");
  const base = filename.replace(/\\/g, "/");
  const candidates = ["docs.json", "mint.json"];
  return candidates.some((c) => base === (root && root !== "." ? `${root}/${c}` : c));
}

export function buildUrl(previewBase: string, slug: string): string {
  const base = previewBase.replace(/\/+$/, "");
  return slug ? `${base}/${slug}` : base;
}

export function collectPageChanges(
  files: ChangedFile[],
  docsPath: string,
  previewBase: string
): { pages: PageChange[]; navChanged: boolean } {
  const pages: PageChange[] = [];
  let navChanged = false;
  for (const f of files) {
    if (isNavConfig(f.filename, docsPath)) {
      navChanged = true;
      continue;
    }
    const slug = pathToSlug(f.filename, docsPath);
    if (slug === null) continue;
    const status = normalizeStatus(f.status);
    pages.push({ path: f.filename, slug, status, url: buildUrl(previewBase, slug) });
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  return { pages, navChanged };
}

function normalizeStatus(s: string): ChangeStatus {
  if (s === "added" || s === "modified" || s === "removed" || s === "renamed") return s;
  if (s === "copied") return "added";
  if (s === "changed") return "modified";
  return "modified";
}

export const MARKER = "<!-- mint-pr-diff -->";

export function renderComment(pages: PageChange[], navChanged: boolean, previewBase: string): string {
  const lines: string[] = [MARKER, "### Docs pages changed in this PR", ""];
  if (navChanged) {
    lines.push("> Navigation config (`docs.json`) changed. Check the sidebar on the preview.", "");
  }
  if (pages.length === 0) {
    lines.push("_No `.mdx` / `.md` pages changed._");
  } else {
    lines.push("| Page | Status | Preview |", "|---|---|---|");
    for (const p of pages) {
      const label = (p.slug || "(home)").replace(/\|/g, "\\|").replace(/`/g, "'");
      const link = p.status === "removed" ? "—" : `[open](${p.url})`;
      lines.push(`| \`${label}\` | ${p.status} | ${link} |`);
    }
  }
  lines.push("", `<sub>Preview base: ${previewBase} · posted by mint-pr-diff</sub>`);
  return lines.join("\n");
}


/** Language folders that mirror the English tree, e.g. es/, fr/, zh/, pt-BR/. */
const LANG_DIR = /^[a-z]{2}(-[A-Z]{2})?$/;

export function detectLanguages(repoPaths: string[], docsPath: string): string[] {
  const root = docsPath.replace(/^\.\/?/, "").replace(/\/+$/, "");
  const prefix = root && root !== "." ? root + "/" : "";
  const all = new Set(repoPaths);
  const counts = new Map<string, number>();
  for (const p of repoPaths) {
    if (!p.startsWith(prefix) || !PAGE_EXT.test(p)) continue;
    const rel = p.slice(prefix.length);
    const first = rel.split("/")[0];
    // a language folder mirrors English paths, so only count files that have an English twin
    if (LANG_DIR.test(first) && rel.includes("/") && all.has(prefix + rel.slice(first.length + 1))) counts.set(first, (counts.get(first) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 5).map(([l]) => l).sort();
}

export interface DriftItem { page: string; behind: string[]; }

/** English pages changed in this PR whose translated copies exist but were not changed in this PR. */
export function translationDrift(files: ChangedFile[], repoPaths: string[], docsPath: string, langs: string[]): DriftItem[] {
  if (!langs.length) return [];
  const root = docsPath.replace(/^\.\/?/, "").replace(/\/+$/, "");
  const prefix = root && root !== "." ? root + "/" : "";
  const changed = new Set(files.map((f) => f.filename));
  const exists = new Set(repoPaths);
  const out: DriftItem[] = [];
  for (const f of files) {
    if (f.status === "removed" || !f.filename.startsWith(prefix) || !PAGE_EXT.test(f.filename)) continue;
    const rel = f.filename.slice(prefix.length);
    if (LANG_DIR.test(rel.split("/")[0]) || rel.startsWith("snippets/")) continue;
    const behind = langs.filter((l) => exists.has(prefix + l + "/" + rel) && !changed.has(prefix + l + "/" + rel));
    if (behind.length) out.push({ page: rel.replace(PAGE_EXT, ""), behind });
  }
  return out.sort((a, b) => a.page.localeCompare(b.page));
}

export function renderDrift(drift: DriftItem[]): string {
  if (!drift.length) return "";
  const lines = ["", "### Translations not updated in this PR", "",
    "These English pages changed, but their translated copies did not. They will be out of date until the next translation sync.", "",
    "| English page | Behind |", "|---|---|"];
  for (const d of drift) lines.push(`| \`${d.page.replace(/\|/g, "\\|")}\` | ${d.behind.join(", ")} |`);
  return lines.join("\n");
}
