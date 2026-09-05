# AKUMA

**Bounded-autonomy AI commerce platform for local merchants.**

AKUMA gives a small or independent merchant the kind of data-driven operating layer that large marketplaces build for themselves — an AI that reads a merchant's own orders, products, and customers, finds concrete revenue opportunities, and proposes actions the merchant can review and approve. On the other side of the same system, shoppers get an AI-assisted catalog, cart, and negotiation experience backed by the same policy engine. Merchant and customer are not two separate apps bolted together — they read and write the same underlying data.

## Problem it solves

Local and independent merchants generally have no visibility into things like which products are actually driving repeat purchases, which customers are at risk of churning, where inventory is tying up cash, or when a price is leaving margin on the table. Building that kind of intelligence in-house is normally out of reach for a small operation. AKUMA turns a merchant's existing transactional data into that intelligence automatically, and keeps a human in control of every consequential action.

## Why it's useful for local merchants

- No manual analytics work — dashboards and opportunity detection run against the merchant's real orders, products, and customers as soon as data exists.
- No black-box automation — every AI-proposed action is checked against merchant-defined policy limits before it can execute, and every action is written to an audit log.
- No separate systems to reconcile — the merchant dashboard and the customer-facing shop share one Prisma schema, so a negotiation, an order, or a policy change is visible from both sides immediately.
- Works with nothing configured — without a database or AI provider key, AKUMA falls back to a clearly-labeled deterministic local simulation instead of failing or fabricating data, so the product is inspectable before any infrastructure is set up.

## Core features

- **AI-detected revenue opportunities** — pricing gaps, churn risk, revenue leaks, demand matching, and inventory clearance candidates, each with a confidence score and the evidence behind it.
- **Bounded autonomy approval flow** — an opportunity moves from `DISCOVERED` to `PROPOSED`/`APPROVAL_REQUIRED` to `ACTIVE` only after passing policy checks and merchant approval; nothing executes unattended beyond what the merchant's own policy explicitly allows.
- **Policy engine** — per-merchant limits (max discount %, minimum margin %, max single transaction, approval threshold) and feature toggles (recommendations, cross-sell, upsell, negotiation, auto-approval) that every AI action is checked against.
- **Audit trail** — every policy-checked action, order event, and payment verification is written to an append-only audit log, scoped per merchant.
- **Merchant analytics suite** — churn & win-back, customer lifetime value, funnel analysis, segmentation, pricing analysis, A/B experiments, and goal tracking, all computed from real Prisma data (or the local deterministic fallback when no database is configured).
- **AI shopping assistant** — a Groq-backed conversational agent for both merchants ("analyze my store") and shoppers ("find me headphones under ₹5,000"), using real tool calls against the catalog and store metrics rather than free-form generation.
- **Price negotiation** — shoppers can request a price, merchants (or the AI, within policy) can counter, accept, or decline, with a live negotiation banner on both sides.
- **Payments** — Razorpay Test Mode integration with webhook signature verification, backed by a local payment simulation when Razorpay isn't configured.

## How the merchant side works

A merchant signs in and lands on a dashboard summarizing real revenue, order count, open opportunities, and pending approvals pulled from their own data. AKUMA's analysis step looks at orders, products, and customer behavior to surface opportunities (e.g. a high-margin cross-sell pattern, an at-risk customer segment, a mispriced product). Each opportunity carries its supporting evidence and a policy-compliance check. Approving one creates the underlying campaign/action and logs it; nothing is applied silently. Separate dashboard views cover inventory, pricing, churn, segmentation, campaigns, experiments, goals, revenue leaks, the audit trail, and merchant policy configuration.

## How the customer side works

A shopper browses a merchant's live catalog, adds items to a cart backed by a real shopping-session record, and can either check out directly (Razorpay Test Mode) or negotiate a price on an item before buying. Order history, delivery addresses, wishlist, and reviews are all backed by their own Prisma models rather than client-only state.

## AI conversational experience

The agent (`ai/agents/akuma-agent.ts`, served through Groq) is given a fixed set of tools — `searchProducts`, `getStoreMetrics`, `getTopProducts`, `getCustomerSegments`, `getProductAffinity`, `getRevenueTrends`, `getMerchantPolicy`, `getProducts`, `simulateOffer`, `checkGuardrails`, `proposeCampaign` — and answers by calling them against real data, not by generating unconstrained text. If `GROQ_API_KEY` is missing or the provider is unreachable, the agent explicitly falls back to deterministic, tool-only answers instead of hallucinating a response, and `/api/ai/health` reports the real connection status and latency.

## Architecture

```
app/            Next.js App Router — pages (dashboard/*, shop/*) and API routes (api/**)
components/     Shared UI components (design system primitives, negotiation banner, agent console)
ai/             Groq client, agent orchestration, tool definitions
lib/            Domain logic — churn, funnel, segmentation, pricing, guardrails, auth, resolve-merchant, etc.
prisma/         schema.prisma, migrations/, seed.ts
public/         Static assets
tests/          Vitest unit tests
```

Merchant identity for a request is always resolved through a single shared helper (`lib/resolve-merchant.ts`), so every merchant-scoped API route reads and writes the same merchant record regardless of how the session was created (demo login, OTP login, or Google OAuth).

## Technology stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg`)
- **Cache/queues:** Redis (`ioredis`), BullMQ
- **AI:** Groq SDK
- **Payments:** Razorpay Node SDK (Test Mode)
- **Auth:** Signed HTTP-only session cookies, Google OAuth (`next-auth`), email/phone OTP via Resend
- **Validation:** Zod
- **Animation:** Framer Motion
- **Testing:** Vitest, Playwright
- **Linting/types:** ESLint, TypeScript (`tsc --noEmit`)

## Database / Prisma

The schema (`prisma/schema.prisma`) models the full domain in one place, including: `Merchant`, `User`, `StoreConnection`, `Product`, `Order`/`OrderItem`, `Transaction`, `Opportunity`, `AgentRun`/`AgentAction`, `Approval`, `Campaign`, `Policy`, `AuditLog`, `Goal`, `Experiment`/`ExperimentVariant`, `ConsumerProfile`, `DeliveryAddress`, `Wishlist`, `ShoppingSession`/`CartItem`, `Negotiation`/`NegotiationAudit`, `BuyerInterest`, `Review`, `Notification`/`NotificationPreference`, `Conversation`/`ConversationMessage`, and `WebhookEvent`. Monetary values are stored as integer paise. Migrations live under `prisma/migrations/`.

When `DATABASE_URL` is not set, routes fall back to a deterministic, clearly-labeled local data generator (`lib/domain.ts`) instead of a live database — this is disclosed behavior for running the product without infrastructure, not a hidden default.

## API / backend overview

Representative route groups under `app/api/`:

- `dashboard`, `opportunities`, `approvals`, `pricing`, `churn`, `funnel`, `segmentation`, `analytics/clv`, `experiments`, `merchant/goals`, `campaigns`, `revenue-leaks`, `audit`, `policy`, `merchant/profile`, `merchant/policy`, `merchant/location`
- `consumer/catalog`, `consumer/cart`, `consumer/checkout`, `consumer/negotiation`, `consumer/orders`, `consumer/wishlist`, `consumer/reviews`, `consumer/delivery-address`, `consumer/addresses`
- `auth/login`, `auth/me`, `auth/logout`, `auth/phone/send-otp`, `auth/phone/verify-otp`, `auth/google`, `auth/demo`
- `ai/chat`, `ai/health`
- `webhooks/razorpay`

## Authentication

Sessions are signed, HMAC-verified, HTTP-only cookies (`lib/auth.ts`), issued through one of three paths: email/phone OTP (delivered via Resend, with a console-logged fallback code in development), Google OAuth (server-side authorization-code flow), or a built-in demo login gated behind `DEMO_LOGIN_ENABLED` (off by default in production) for evaluating the product without setting up email delivery.

## Local development setup

```bash
git clone https://github.com/nilaj7888-dev/akuma.git
cd akuma
npm install
cp .env.example .env
```

Fill in the environment variables you need (see below), then start the local database and cache:

```bash
docker compose up -d      # PostgreSQL + Redis
npm run db:generate       # prisma generate
npm run db:migrate        # apply migrations
npm run db:seed           # seed demo data
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Names only — see `.env.example` for the full annotated template. Never commit real values.

```
DATABASE_URL
REDIS_URL
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
GOOGLE_PLACES_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_API_KEY
TWILIO_API_SECRET
TWILIO_VERIFY_SERVICE_SID
TWILIO_MESSAGING_SERVICE_SID
NEXT_PUBLIC_APP_URL
GROQ_API_KEY
GROQ_MODEL
GROQ_FAST_MODEL
RESEND_API_KEY
DEMO_LOGIN_ENABLED
DEMO_MERCHANT_EMAIL
DEMO_MERCHANT_PIN
DEMO_CONSUMER_EMAIL
DEMO_CONSUMER_PIN
```

Every feature that depends on one of these degrades to an honest fallback state (not a crash, not fabricated data) when the variable is unset — see `/api/health` and `/api/ai/health` for live status.

## Database migrations

```bash
npx prisma migrate dev      # create/apply a migration in development
npx prisma generate         # regenerate the Prisma client after a schema change
npx prisma migrate deploy   # apply pending migrations in production
```

## Build, typecheck, and test

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run build       # Next.js production build
```

`.github/workflows/ci.yml` runs all four on every push and pull request against `main`.

## Deployment

AKUMA is a standard Next.js 16 App Router application and deploys to any platform that supports Next.js (Vercel, a Node server, or a container). In production, set the environment variables above (at minimum `DATABASE_URL`, `AUTH_SECRET`, and `GROQ_API_KEY` for the full experience), run `npx prisma migrate deploy` against the production database, and build with `npm run build`.

## Future improvements

- Expand automated test coverage beyond the current unit tests in `tests/`
- Move production authentication onto a dedicated identity provider rather than the current custom session cookie
- Complete end-to-end Razorpay live-mode reconciliation (currently Test Mode only)
- Add Playwright coverage for the full merchant approval and checkout state machines

## License

No license file is currently included in this repository. Add a `LICENSE` file (e.g. MIT, Apache 2.0) before treating this as open source.
