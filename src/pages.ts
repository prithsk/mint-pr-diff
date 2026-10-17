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
