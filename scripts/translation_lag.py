"""Repo-wide translation lag for a Mintlify docs repo. Standard library only.

  python scripts/translation_lag.py /path/to/docs-repo [--since 2026-09-23]

Lists English pages whose es/, fr/, zh/ (or any detected language) copies are older than the
English page, by last commit time.
"""
import argparse, collections, datetime, re, subprocess, sys
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
LANG = re.compile(r"^[a-z]{2}(-[A-Z]{2})?$")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("repo"); ap.add_argument("--since", help="only English edits after this date, e.g. your last sync")
    a = ap.parse_args()
    log = subprocess.run(["git", "-C", a.repo, "log", "--no-merges", "--name-only", "--format=@@%ct"], capture_output=True, text=True, encoding="utf-8").stdout
    last, t = {}, 0
    for line in log.splitlines():
        if line.startswith("@@"): t = int(line[2:]); continue
        f = line.strip()
        if f.endswith((".mdx", ".md")) and f not in last: last[f] = t
    # a language folder mirrors English paths: count files whose path minus the prefix is also an English page
    counts = collections.Counter(f.split("/")[0] for f in last if "/" in f and LANG.match(f.split("/")[0]) and f.split("/", 1)[1] in last)
    langs = sorted(l for l, n in counts.items() if n >= 5)
    cut = int(datetime.datetime.fromisoformat(a.since).timestamp()) if a.since else 0
    rows = []
    for f, ts in last.items():
        first = f.split("/")[0]
        if LANG.match(first) or f.startswith("snippets/") or ts < cut: continue
        behind = [l for l in langs if f"{l}/{f}" in last and last[f"{l}/{f}"] < ts]
        if behind: rows.append((datetime.date.fromtimestamp(ts), f, behind))
    rows.sort()
    print(f"languages: {', '.join(langs) or 'none found'}")
    print(f"English pages ahead of their translations{' since ' + a.since if a.since else ''}: {len(rows)}  |  translated copies behind: {sum(len(b) for *_, b in rows)}")
    for d, f, b in rows: print(f"  {d}  {f}  ->  {', '.join(b)}")

if __name__ == "__main__": main()
