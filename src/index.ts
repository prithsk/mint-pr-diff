import * as core from "@actions/core";
import * as github from "@actions/github";
import { collectPageChanges, renderComment, MARKER, ChangedFile, detectLanguages, translationDrift, renderDrift } from "./pages";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github_token", { required: true });
    const docsPath = core.getInput("docs_path") || ".";
    const previewBase = core.getInput("preview_base_url", { required: true });
    const commentWhenEmpty = core.getBooleanInput("comment_when_empty");

    const ctx = github.context;
    const pr = ctx.payload.pull_request;
    if (!pr) {
      core.info("Not a pull_request event; nothing to do.");
      return;
    }

    const octokit = github.getOctokit(token);
    const { owner, repo } = ctx.repo;

    const files: ChangedFile[] = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    });

    const { pages, navChanged } = collectPageChanges(files, docsPath, previewBase);

    // one recursive tree call tells us which translated copies exist
    let drift: ReturnType<typeof translationDrift> = [];
    const langInput = core.getInput("languages");
    if (langInput !== "none") {
      const tree = await octokit.rest.git.getTree({ owner, repo, tree_sha: pr.head.sha, recursive: "true" });
      const paths = tree.data.tree.filter((t) => t.type === "blob").map((t) => t.path as string);
      const langs = langInput ? langInput.split(",").map((l) => l.trim()).filter(Boolean) : detectLanguages(paths, docsPath);
      drift = translationDrift(files, paths, docsPath, langs);
    }
    core.setOutput("translations_behind", String(drift.reduce((n, d) => n + d.behind.length, 0)));
    core.setOutput("changed_count", String(pages.length));
    core.setOutput("changed_slugs", pages.map((p) => p.slug).join(","));

    if (pages.length === 0 && !navChanged && drift.length === 0 && !commentWhenEmpty) {
      core.info("No docs pages changed; skipping comment.");
      return;
    }

    const body = renderComment(pages, navChanged, previewBase).replace("\n\n<sub>", renderDrift(drift) + "\n\n<sub>");

    const existing = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pr.number,
      per_page: 100,
    });
    const mine = existing.find((c) => (c.body || "").includes(MARKER));

    if (mine) {
      await octokit.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
      core.info(`Updated comment ${mine.id} with ${pages.length} page(s).`);
    } else {
      await octokit.rest.issues.createComment({ owner, repo, issue_number: pr.number, body });
      core.info(`Posted comment with ${pages.length} page(s).`);
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
