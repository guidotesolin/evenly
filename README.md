# Evenly

Household expenses for two (or more): each person's monthly fixed costs with a reference dollar,
plus a Tricount-style shared list that splits evenly and settles up. Android app built with
React Native + Expo on Supabase. UI in Spanish.

Design and reasoning: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Task board:
[docs/TASKS.md](docs/TASKS.md).

## Setup

Requirements: Node 24 (`.nvmrc`), Docker (for the local Supabase stack), and for running on a
device the Android SDK with a phone in USB debugging mode.

```bash
npm ci
cp .env.example .env
git config core.hooksPath .githooks
```

The pre-commit hook rejects env files and, when [gitleaks](https://github.com/gitleaks/gitleaks)
is installed, scans staged content for secrets.

## Development

The app uses native modules, so it runs in a development build, not Expo Go:

```bash
npm run android   # builds and installs the dev client on the connected device
npm start         # starts Metro for the installed dev client
```

## Checks

```bash
npm run lint          # ESLint + Oxlint with the vendored anti-slop rules
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
```

CI runs the same three on every push to `main` and on pull requests.

## License

[MIT](LICENSE)
