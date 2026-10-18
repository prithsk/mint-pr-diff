# mint-pr-diff

A GitHub Action that comments which Mintlify docs pages changed in a pull request, with a preview link for each one.

Mintlify builds a preview for every PR, but reviewers have to work out which pages to look at by reading the diff. This action posts one sticky comment with a table of changed pages, their status, and a link straight to each page on the preview.

![example comment](docs/example.png)

## What it found in Mintlify's own docs

I ran the translation check on [mintlify/docs](https://github.com/mintlify/docs) as of its October 16, 2026 commit.

- Over the six months to October 16, 994 commits edited English pages. 58% of them did not touch the es, fr or zh copies in the same commit.
- A weekly "Translation lag tracker" PR syncs them. Its 90th-percentile wait for the Spanish copy of an edited page was 17 days, and 56 English edits never got a Spanish update at all.
- The last sync in the log is September 23. Since then, **21 English pages have changed while 40 of their translated copies stayed behind.**

The action now catches this at review time. Every docs PR comment lists the English pages it changed whose translated copies it left alone, so the gap is visible before merge and not three weeks later.

Reproduce the repo-wide number on any Mintlify repo:

```
python scripts/translation_lag.py path/to/docs-repo --since 2026-09-23
```

Honest limits: "behind" means the translated file's last commit is older than the English file's. A translation can be older and still correct, for example after a typo fix in English. The count is an upper bound on stale content, not a measure of it.

## Usage

```yaml
# .github/workflows/docs-diff.yml
name: docs diff
on:
  pull_request:
    paths: ["docs/**"]
permissions:
  pull-requests: write
  contents: read   # also used to read the repo tree for the translation check
jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: prithsk/mint-pr-diff@v0.2.0
        with:
          docs_path: docs
          preview_base_url: https://${{ github.event.repository.name }}-${{ github.head_ref }}.mintlify.app
```

If your docs live at the repo root, drop `docs_path`.

## Inputs

| Input | Required | Default | What it does |
|---|---|---|---|
| `preview_base_url` | yes | | Base URL of the preview deployment for this branch. |
| `docs_path` | no | `.` | Folder that holds `docs.json` and your pages. |
| `github_token` | no | `${{ github.token }}` | Needs `pull-requests: write`. |
| `languages` | no | auto | Translation folders to check, like `es,fr,zh`. Auto-detects two-letter folders that mirror English paths. `none` turns it off. |
| `comment_when_empty` | no | `false` | Post a comment even when no pages changed. |

## Outputs

| Output | What it is |
|---|---|
| `changed_count` | Number of pages changed. |
| `changed_slugs` | Comma-separated slugs, for downstream steps. |
| `translations_behind` | Translated copies this PR left behind. |

## How slugs are computed

The action maps file paths to URLs the way Mintlify does.

- `quickstart.mdx` → `/quickstart`
- `guides/index.mdx` → `/guides`
- `index.mdx` → `/`
- A change to `docs.json` or `mint.json` is flagged separately since it moves pages around without changing their files.

## Preview URL

Mintlify's branch previews follow `https://<project>-<branch>.mintlify.app` for GitHub-connected projects. Pass whatever your project uses. The action doesn't guess.

## Sticky comment

The comment carries a hidden marker. On every push the action finds its own earlier comment and edits it instead of posting a new one.

## Development

```
npm install
npm test      # unit tests for slug mapping and rendering
npm run build # bundles to dist/ with ncc
```

Dependencies are pinned to exact versions.

## License

MIT
