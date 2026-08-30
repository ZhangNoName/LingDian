---
name: lingdian-git-push
description: Commit or push changes from the LingDian repository to its configured GitHub origin with macOS Apple Git. Use when the user asks to commit, push, or publish LingDian code; do not use for repository synchronization or other repositories.
---

# LingDian Git 提交与推送

Use `/usr/bin/git` explicitly for every Git command. Do not substitute Homebrew Git, `gh`, a GitHub API, or another upload path.

## Confirm the repository and scope

1. Read every applicable `AGENTS.md` before acting.
2. Require the repository root name to be `LingDian`. Require exactly one `origin` fetch URL and exactly one push URL, obtained with `/usr/bin/git remote get-url --all origin` and `/usr/bin/git remote get-url --all --push origin`. Require both to equal the same one of `https://github.com/ZhangNoName/LingDian.git` or `git@github.com:ZhangNoName/LingDian.git`. Stop on any additional URL, mixed transport, or mismatch.
3. Run `/usr/bin/git fetch --prune origin`, then inspect the current branch, upstream, status, and remote default branch. If an upstream exists, compare `HEAD...<upstream>` with `/usr/bin/git rev-list --left-right --count`: the first count is local-only and the second is upstream-only. Stop whenever the upstream-only count is nonzero. If no upstream exists but an origin branch with the same name does, compare against that ref with the same rule.
4. Preserve unrelated user changes. Stage explicit paths unless the user asked to deliver the complete reviewed worktree. Never use `git reset --hard`, force push, or rewrite existing history.
5. Before staging, check that target files contain no private keys, tokens, generated passwords, real `.env` files, build output, or unrelated artifacts.
6. Require a named local branch. Before either commit or push, if it is the remote default branch, create a concise `zxy/<topic>` feature branch from the existing state. Do not create a worktree.
7. For any request that includes push, verify before staging or committing that the upstream is either absent or exactly `origin/<current-branch>`. Stop on any other upstream.

## Choose the requested operation

- Commit only: review, validate, stage, and commit; do not push.
- Push or publish only: push already committed `HEAD`; do not stage or commit dirty worktree changes. Report that they remain local.
- Commit and push: perform the commit workflow first, then push that resulting commit.

Do not interpret “同步” as authorization to commit or push. Follow the repository's separate `git-clean-sync` instructions for synchronization requests.

## Commit

- Stop on branch divergence; do not merge, rebase, reset, or force push automatically.
- Run validation proportionate to the changes and record only commands that actually passed. For deployment, database, observability, or shared build changes, run at minimum:

```sh
pnpm test
pnpm run type-check
pnpm run build
/usr/bin/git diff --check
```

- Only when commit was requested, stage the reviewed scope with `/usr/bin/git add -- <paths>`. Recheck `/usr/bin/git diff --cached --check`, staged names, and staged statistics.
- Use a concise Chinese commit message unless the user specifies another language or exact message. Do not create an empty commit.

## Push

Push only after the user has explicitly requested it:

```sh
branch="$(/usr/bin/git branch --show-current)"
upstream="$(/usr/bin/git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if test -z "$upstream"; then
  /usr/bin/git -c http.version=HTTP/1.1 \
    push --no-verify -u origin "HEAD:refs/heads/$branch"
elif test "$upstream" = "origin/$branch"; then
  /usr/bin/git -c http.version=HTTP/1.1 \
    push --no-verify origin "HEAD:refs/heads/$branch"
else
  echo "unexpected upstream: $upstream" >&2
  exit 1
fi
```

The command-scoped `--no-verify` is intentional and authorized for this repository: it bypasses the machine-level `pre-push` hook only for this push without changing global hook configuration. Do not synthesize hook allow files, force push, or change transport. If GitHub, authentication, network, or a non-fast-forward check still rejects the push, stop and report the exact blocker without retrying through another upload mechanism.

## Verify and report

After a successful push, require the remote branch SHA to equal local `HEAD`:

```sh
branch="$(/usr/bin/git branch --show-current)"
local_sha="$(/usr/bin/git rev-parse HEAD)"
remote_sha="$(/usr/bin/git ls-remote --heads origin "refs/heads/$branch" | awk 'NR == 1 { print $1 }')"
if test -z "$remote_sha" || test "$remote_sha" != "$local_sha"; then
  echo "remote SHA does not match local HEAD" >&2
  exit 1
fi
/usr/bin/git status --short --branch
```

Report the GitHub repository, branch, full commit SHA, Chinese subject, validation results, and whether the worktree is clean. Do not create or update a pull request unless the user explicitly asks for one.
