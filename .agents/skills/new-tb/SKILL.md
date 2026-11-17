---
name: new-tb
description: Use when the user says "New PTB" to create a patch test branch or "New FTB" to create a feature test branch. "New TB" without a prefix asks which type. Keep release versions synchronized.
---

# New TB

## Commands and versioning

- **New PTB**: create a patch test branch; increment Major.Minor.Patch to Major.Minor.(Patch+1). Example: 1.8.20 → 1.8.21.
- **New FTB**: create a feature test branch; increment the minor version and reset the patch to zero. Example: 1.8.20 → 1.9.0. This does not increment the major version.
- **New TB** without P or F: ask whether the user wants a patch or feature test branch. If the active request already says patch or feature, use that answer without asking again.

Match commands case-insensitively. The user may include a task description or branch name. Creating or discussing this skill is not an instruction to create a branch. Do not merge or delete existing branches as part of branch creation.

## Workflow

1. Read AGENTS.md and the repository's development guidance. Inspect the current branch, working directory, remotes, local branches, and current remote refs using the existing authenticated Git connection. Preserve unrelated changes and local-only commits. Never reset, overwrite, or automatically commit unrelated work. Use the existing checkout; do not create a worktree unless explicitly requested.
2. Default to the latest fetched main as the base. If the user explicitly says the new work depends on an unmerged test branch, base it on that branch to preserve its changes. Do not silently carry changes from whichever test branch happens to be checked out. Ask only if dirty files, divergent history, or unclear dependencies prevent a safe branch creation.
3. Read the actual base version rather than assuming the examples above are current. Check that extension/manifest.json, package.json, package-lock.json (including the root package entry), and README release references agree. Investigate inconsistencies before choosing a new version.
4. Compute the next version for P or F. For SC-DMV-Hotkeys use fix/v<VERSION>-<description> for patch branches and feat/v<VERSION>-<description> for feature branches. Derive a short description from the requested work; if no work is specified, use patch-test or feature-test. Honor an explicit branch name. Check both local and remote names for collisions; never overwrite or reset an existing branch. If the intended name already exists, ask whether to continue that branch or create a distinct one.
5. Create and switch to the new branch. Update all four release-version locations together to the computed version, including both package-lock.json version entries. Leave dependency versions and unrelated historical version references unchanged. Record the branch, base, version, and intended scope in AGENTS.md. Branch creation alone does not authorize inventing a feature or fix.
6. Run npm run check and git diff --check for a version-only preparation. Inspect the diff to ensure only intended release references and context changed. When the request includes implementation work, complete it and run the relevant tests before reporting that work as ready. Do not claim application tests ran when only version checks ran.
7. Commit only the intended preparation/work and push the new branch with upstream tracking so the user can test it on GitHub, unless the user requested a local-only branch. Do not push main or force-push an existing branch. Verify the remote branch tip and final working-directory status.
8. Report the new branch name, version, base, and checks actually completed. If the user supplied only the creation command, stop after preparing and pushing the branch; do not invent implementation work.

## Subsequent changes

The initial P/F prefix chooses the branch's release increment. Each subsequent code or UI revision on that same branch still receives a patch-version increment, with manifest, package, lockfile, and README kept synchronized. A documentation-only update does not require a release bump. Use the separate Merge TB skill only when the user invokes a merge.
