---
name: task
description: Start a task card from docs/TASKS.md (e.g. /task T7). Loads ARCHITECTURE.md and that one card, invokes ponytail.
disable-model-invocation: true
---

# Start a task card

The argument is a card ID (`T7`) or a branch name. Without one, print the board's pending rows
from `docs/TASKS.md` and stop.

1. **Read the card**: its board row (`Depends on`) and its `### T<n>` section. Read
   `docs/ARCHITECTURE.md` in full. Those two plus the card are the brief.
2. **Check dependencies.** If one is not marked done, say so and stop.
3. **Branch only if told to.** If the maintainer ordered it, use the board's branch name off an
   up-to-date `main`. If the tree is dirty, stop and report it — do not stash.
4. **Invoke ponytail** before writing any code.
5. **Build to the card's acceptance criteria**, not beyond them. Shortcuts get a `ponytail:` comment.
6. **Verify** against `_Acceptance_`, then lint (ESLint and oxlint) and build. Report what ran and
   what it printed.
7. **Do not commit.** Finish with `/propose-commit`.
