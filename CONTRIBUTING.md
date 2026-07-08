# Contributing to Gabriel

Thanks for your interest in contributing to Gabriel! This guide covers setup, code style, how to contribute features, and how to advance existing capabilities.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/LilGabrielDev/gabrielagent.git
cd gabrielagent

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string and WhatsApp service URL

# Run database migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

### WhatsApp Service (Optional, for channel testing)

The main app proxies WhatsApp QR and pairing to a standalone backend. Run it locally while developing channel features:

```bash
cd whatsapp-service
npm install
cp .env.example .env   # if present, or set PORT and SESSION_PATH
npm run dev
```

Set in the root `.env`:

```env
# Local development (whatsapp-service on port 3001)
WHATSAPP_SERVICE_URL="http://localhost:3001"

# Production on Katabump (replace with your kdns.fr subdomain)
# WHATSAPP_SERVICE_URL="https://gabriel-whatsapp.kdns.fr"

WHATSAPP_SERVICE_API_KEY=""   # must match whatsapp-service API_KEY if set
```

Deploy the same service to Render, Railway, or Katabump for production. The dashboard on Vercel only needs `WHATSAPP_SERVICE_URL` pointing at that host.

## Ways to Contribute

| Type | What to do |
|------|------------|
| **Report bugs** | Open a GitHub issue with steps to reproduce, expected vs actual behavior, and logs |
| **Suggest features** | Open an issue describing the problem, proposed solution, and affected pages/APIs |
| **Contribute your own feature** | Fork, branch from `main`, implement with tests, open a PR (see below) |
| **Advance existing features** | Improve WhatsApp pairing/QR, channels, AI tools, webhooks, etc. without changing scope |
| **Improve docs** | Update `docs/wiki/` or this file; keep Architecture and Channel docs in sync with code |
| **Write tests** | Add Vitest coverage under `tests/unit/`, `tests/api/`, or `tests/security/` |

## Feature Areas

These are the main areas where contributions have high impact:

### Channels (WhatsApp, Email, Phone)

- **WhatsApp Web (QR)** — scan-to-connect via the external `whatsapp-service` (Baileys)
- **WhatsApp Pairing Code** — phone number + 8-character code flow for Linked Devices
- **WhatsApp Business API** — credential storage; outbound/inbound via Meta webhooks (extend as needed)
- **Email** — SMTP/IMAP configuration and polling
- **Phone** — Twilio + ElevenLabs voice

When changing WhatsApp behavior, update both `src/lib/channels/whatsapp.ts` and `whatsapp-service/src/session-manager.ts`, and document env vars in `.env.example`.

### Dashboard Pages

All routes under `src/app/(dashboard)/` should load without errors when authenticated:

| Path | Purpose |
|------|---------|
| `/` | Dashboard overview (Quick Actions, System Status) |
| `/conversations` | Inbox |
| `/customers` | Customer list |
| `/channels` | Channel setup (WhatsApp QR/pair/API) |
| `/knowledge` | Knowledge base |
| `/knowledge/test` | Test AI against KB |
| `/help` | Sitemap and getting started |
| `/settings` | App settings |
| `/team`, `/tickets`, `/sla`, `/webhooks`, `/automation`, etc. | Feature modules |

Run `npm run build` before submitting UI changes.

### API & AI

- REST routes in `src/app/api/` (auth via `gabriel-token` cookie or `X-API-Key`)
- AI engine: `src/lib/ai/engine.ts`, tools in `src/lib/ai/tools.ts`

## Contribute Your Own Feature (Checklist)

1. **Discuss** — Open an issue for large changes so maintainers can align on approach
2. **Branch** — `git checkout -b feat/your-feature-name`
3. **Implement** — Follow code style below; reuse existing components and patterns
4. **Test** — Add or update Vitest tests; run `npm run test`
5. **Lint & types** — `npm run lint` and `npx tsc --noEmit`
6. **Build** — `npm run build`
7. **Document** — Update wiki pages if user-facing behavior changes
8. **PR** — Clear title, summary, and test plan

## Advancing Existing Features

To improve something already in Gabriel without adding a new module:

1. Read the relevant wiki page in `docs/wiki/` (e.g. [WhatsApp Channel](docs/wiki/WhatsApp-Channel.md))
2. Trace the code path (UI → API route → `src/lib/` or `whatsapp-service/`)
3. Keep changes focused; avoid unrelated renames in the same PR
4. Ensure **both** local dev and hosted split setup work (Vercel + external WhatsApp service)
5. Add tests that mock external services (see `tests/unit/pairing-code.test.ts`)

## Code Style

- **TypeScript** for all code
- **Tailwind CSS** with Gabriel colors (`gabriel-primary`, `gabriel-surface`, etc.)
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Zod validation** on API bodies (`src/lib/validations.ts`)
- **Structured logging** via `logger` from `src/lib/logger.ts` (never `console.log` in app code)
- **Pagination** on list endpoints using `parsePagination` / `paginatedResponse`
- **Errors** via `AppError` and `Errors` from `src/lib/errors.ts`
- No emojis in code, commits, or UI text
- All UI text in English
- Auth cookie name: `gabriel-token`

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run all tests (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run db:seed      # Seed sample data
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

## Project Structure

```
src/
  app/
    (auth)/          # Login, setup wizard
    (dashboard)/     # Dashboard pages
    api/             # REST API routes (60+ endpoints)
  components/
    layout/          # Sidebar, header
    ui/              # Reusable components
  lib/
    ai/              # AI engine, tools
    channels/        # WhatsApp, email, phone
    customer-resolver.ts
    errors.ts
    logger.ts
    pagination.ts
    rate-limit.ts
    security.ts
    validations.ts
    webhook-delivery.ts
    hooks/
whatsapp-service/    # Standalone Baileys service (Render/Railway/Katabump)
tests/
  unit/
  api/
  security/
helm/gabriel/        # Kubernetes Helm chart
docs/wiki/           # User and contributor documentation
```

## Writing Tests

All new features must include tests. We use [Vitest](https://vitest.dev/) with mocked Prisma and external HTTP.

```bash
npm run test
npx vitest run tests/unit/pairing-code.test.ts
```

Test files mirror source layout under `tests/`.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes following the code style above
3. Run `npm run test`, `npm run lint`, and `npx tsc --noEmit`
4. Run `npm run build`
5. Write a clear PR description (what, why, how to test)
6. Submit the PR

## Reporting Issues

Use [GitHub Issues](https://github.com/LilGabrielDev/gabrielagent/issues):

- **Bug Report** — something broken (include env: Node version, hosting platform, `WHATSAPP_SERVICE_URL` if relevant)
- **Feature Request** — new capability with use case

## Need Help?

- In-app sitemap: `/help` (after login)
- [README.md](README.md) — features, quick start, deployment
- [Wiki](https://github.com/LilGabrielDev/gabrielagent/wiki) — detailed guides
- [GitHub Discussions](https://github.com/LilGabrielDev/gabrielagent/discussions)
