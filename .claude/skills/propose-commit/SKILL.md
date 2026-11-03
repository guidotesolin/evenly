---
name: propose-commit
description: Propose the commit message and ticket description for the finished task. Claude does not commit; the maintainer reviews and runs it.
disable-model-invocation: true
---

# Propose the commit

The maintainer commits, never you. Produce the text they will use, and stop.

1. **Verify first.** `git status --porcelain` and `git diff`. Lint and build must have passed this
   session; if not, run them and report the real output.
2. **Take the message from the card's `_Commit_` line.** If the delivered scope diverged, propose
   the corrected message and explain the divergence in one line.
3. **English, conventional commits**, one short subject line, no trailer.
4. **Output exactly two blocks:** the `git add … && git commit -m "…"` command, and the ticket
   description (what changed, what acceptance showed, any `ponytail:` shortcut or backlog item it
   earned).
5. Flag anything the pre-commit hook will reject before they run it.
