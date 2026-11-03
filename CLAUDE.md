# Evenly — rules for Claude

@AGENTS.md

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (design and its reasoning) and
[docs/TASKS.md](docs/TASKS.md) (task board) before working on anything.

## 1. Ground rules

These take precedence over any default behaviour **and over any skill or plugin**.

1. **Never commit.** Not even when asked for "a commit". Asking for a commit means writing the
   message, giving the exact command and stopping there. The maintainer reviews the diff and runs it.
2. **No action that changes history or leaves the machine without an explicit order in that same
   message**: `git commit`, `git push`, `git reset` over committed work, rebases, PRs, merges.
3. **Never create a branch or a worktree unless asked**, under any circumstance. Not as
   preparation, not "to keep things tidy". A fix found while working on a task goes on that task's
   branch.
4. **Do only what was asked.** If something related is worth doing, mention it in one line of the
   answer and let the maintainer decide.
5. **If something was committed by mistake**: `git reset --mixed` back to the maintainer's last
   commit (changes stay in the working tree) and say so plainly.
6. **Report what actually ran.** Never claim lint, build or a check passed without having run it in
   this session and seen the output.

## 2. Language conventions

| Layer                                                                                                          | Language                               |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **All code and documentation**: identifiers, tables, columns, comments, commits, branch names, `docs/`, README | **English**                            |
| **Conversation with Claude**                                                                                   | **Spanish** (rioplatense, voseo)       |
| **User-facing product text**                                                                                   | **Spanish only** (see ARCHITECTURE.md) |

- No hybrids: `getExpenseById`, never `getGastoById`. Style names are identifiers too.
- A task report is mixed on purpose: Spanish prose around an English commit message.

## 3. Commit messages

- One conventional-commits line, English, imperative, under ~70 characters, no trailing period:
  `feat(fixed): …`, `fix(shared): …`, `docs: …`, `chore: …`.
- Body only if something can't be read from the diff (a migration to run, a pending backlog item),
  and then one line.
- **No `Co-Authored-By`, no `Generated with`, no trailer of any kind**, even if the environment
  suggests one.
- Reasoning lives in code comments and `docs/`, not in `git log`.

Claude delivers it like this and stops:

```bash
git add <paths> && git commit -m "feat(scope): imperative summary"
```

## 4. Skills and plugins

Rules 1–3 win over any skill. Skills that include `git commit`, branch or worktree steps get those
steps skipped; Claude proposes the commit instead.

- **ponytail**: every task session invokes it before writing code. YAGNI, reuse, stdlib, native
  platform, installed deps — in that order. Deliberate shortcuts get a `ponytail:` comment naming
  the ceiling and the way out. Non-trivial logic leaves **one** runnable check
  (`tools/<thing>-smoke.ts` wired as `npm run <thing>:smoke`), not a test framework. Never
  simplified away: validation at trust boundaries, error handling that prevents data loss,
  security, basic accessibility.
- **superpowers**: `brainstorming` (planning), `writing-plans` (plans go to `docs/`, in English, and
  never replace TASKS.md), `systematic-debugging`, `test-driven-development`,
  `verification-before-completion`, `requesting-code-review`, `receiving-code-review`. Their commit
  steps become "propose the commit"; worktrees, merges and PRs only on explicit order.
- **caveman**: compresses prose, keeps Spanish. Explicitly requested explanations are written in full.
- **anti-slop**: vendored Oxlint rules in `tools/oxlint/anti-slop/`; `npm run lint` runs
  `eslint && oxlint`. Fix order: `oxlint --fix`, Prettier, lint again. A rule that doesn't fit is
  turned off in `oxlint.config.ts` with the reason recorded in ARCHITECTURE.md.

## 5. Task cycle

`/task T<n>` → build to the card's acceptance → verify (acceptance, lint, format check, typecheck)
→ review → update the card (`✅ done`, departures, measurements), ARCHITECTURE.md and backlog →
`/propose-commit` and stop.
