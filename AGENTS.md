# AGENTS.md — Booru Enhancer Extended

Standing instructions for any coding agent working in this repository. Read this file and the controlling specification before proposing or making any change.

## Controlling specification

- `docs/implementation/Final_Implementation_Blueprint.md` is the controlling implementation specification. It is large; do not read it in full for every task. For each task read only: §2 (checkpoint sequence), the active checkpoint's §3 specification, and §11 (handoff protocol). Read other sections only when the active checkpoint references them.
- `docs/implementation/AUDIT_BLUEPRINT_RECONCILIATION.md` records the verified checkpoint state as of the blueprint's introduction. Start from it, then from any later checkpoint records.
- If an instruction, handoff or earlier document conflicts with the blueprint, the blueprint wins. Report the conflict; do not resolve it silently.

## Branch

- Work branch: `implementation/ib00-baseline`.
- `main` is the published baseline. Do not commit to `main`.
- `implementation/ib01-harness` is a separate, diverged branch with an open PR. Do not merge, rebase or modify it unless explicitly asked.

## Checkpoint discipline

- Every task names exactly one blueprint checkpoint (for example "IB07 — Current-host metadata, Post facts and scope corrections") and the blueprint section it is working from. If a task cannot be mapped to a checkpoint, stop and say so.
- Follow the blueprint's §11 one-checkpoint transaction. Do not batch adjacent checkpoints.
- Report outcomes only as PASS(scope), PARTIAL—NOT COMPLETE, BLOCKED/FAIL or EXCLUDED(scope), using the §11 completion record.
- Code presence, a committed document or an unexecuted test is never a PASS.
- Do not invent checkpoints, sub-checkpoints or architecture phases that are not in the blueprint.
- End every task with a status block: checkpoint, commit SHA, tests run and results, open items, next eligible blueprint step.

## Evidence rules

- Every factual claim about the repository cites something checkable: a file path, a line number, a commit SHA or a blob SHA.
- If a file needed for a judgment cannot be read, mark the item UNVERIFIED and name the file. Never infer its contents.
- Search the working tree with `grep`/`git grep`. Do not rely on GitHub code search.

## Keep context small

- `Booru_Enhancer.user.js` is large. Locate code with `grep -n`, then read only the needed line ranges. Do not read the whole file.
- Read prior checkpoint records only when the active checkpoint depends on them.
- Prefer running a test or a script over reading files to establish a fact.

## Existing code: do not re-create

- `BE.adapters`, `BE.core.registerAdapter` and `BE.core.detectAdapter` already exist in `Booru_Enhancer.user.js`.
- `BE.net`, the IB03 runtime boundary, the IB05 settings schema and the IB06 request gate already exist. Extend them; do not replace them.

## Live evidence belongs to the operator

- Live-site observations (V1-N/X) and real-browser conformance runs (Tampermonkey × Chrome and other cells) require the operator's browser. Do not simulate them, and do not treat a sandbox run as live evidence.
- When a checkpoint needs live evidence, prepare the probe or instructions, stop, and hand off. Record the operator's returned results verbatim in the checkpoint record.
- Never perform favorite/bookmark/account mutations, credential handling or production-store experiments.

## Tests

- Local suites are Node-based (`tests/**/*.cjs`). Run the relevant suite before reporting and include the pass/fail counts.
- Preserve historical results and known-failure oracles. Never edit a prior result file to make it pass.

## Sanitation before every commit

This is a public repository. Strict policy:

- No personal names except ChadChan3D. No email addresses except ChadChan addresses.
- No folder names or filesystem paths of any kind (drive letters, user folders, project folders, temp paths). Strip them from test output, stack traces and result files before committing.
- No third-party usernames, handles or social links from captured sites (uploaders, artists, source links).
- Live captures are recorded as structure and patterns, not values: replace post IDs, timestamps, content hashes and per-file URLs with placeholders such as <id>, <hash>, <timestamp>.
- No ad, tracking or third-party CDN URLs.
- No explicit tag text, titles or character names; record which tag categories and fields exist.
- No credentials, tokens, cookies, machine names or account identifiers.
- Browser, manager and OS version strings required by the blueprint's runtime matrix are allowed.

The `.githooks/pre-commit` hook scans staged additions for paths, non-ChadChan emails and social links, and blocks the commit on a match. Never bypass it with `--no-verify`. If it blocks a commit, report the matches and ask.

## Provenance

Follow blueprint §9. GPL or unlicensed donor sources are behavioral references only; never copy or translate their code into this MIT distribution.
