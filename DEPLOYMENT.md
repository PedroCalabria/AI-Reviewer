# Deploying Review Desk to production

Everything below runs on a free tier and none of it asks for a credit card.
Budget about 40 minutes end to end, most of which is waiting for Google's OAuth
consent screen form.

Read [Before you start](#before-you-start) first. One thing in here will bite you
if you skip it: the seed creates a **publicly documented demo password** that
must not survive into a real deployment.

---

## Table of contents

1. [Before you start](#before-you-start)
2. [Step 1 — Create the database](#step-1--create-the-database)
3. [Step 2 — Apply the schema](#step-2--apply-the-schema)
4. [Step 3 — Generate the secrets](#step-3--generate-the-secrets)
5. [Step 4 — Get a Gemini API key](#step-4--get-a-gemini-api-key)
6. [Step 5 — Set up Google sign-in](#step-5--set-up-google-sign-in-optional)
7. [Step 6 — Deploy to Vercel](#step-6--deploy-to-vercel)
8. [Step 7 — Create the first account](#step-7--create-the-first-account)
9. [Step 8 — Schedule the sync](#step-8--schedule-the-sync)
10. [Verification checklist](#verification-checklist)
11. [Environment variables](#environment-variables-in-full)
12. [Free-tier limits](#free-tier-limits-and-what-happens-when-you-hit-them)
13. [Security notes](#security-notes-and-known-limitations)
14. [Troubleshooting](#troubleshooting)

---

## Before you start

You will need accounts on:

| Service | Used for | Card required |
| --- | --- | --- |
| [Neon](https://neon.tech) | Postgres database | No |
| [Vercel](https://vercel.com) | Hosting | No |
| [Google AI Studio](https://aistudio.google.com/apikey) | Gemini API key | No |
| [GitHub](https://github.com) | Source, and the sync schedule | No |
| [Google Cloud Console](https://console.cloud.google.com) | OAuth sign-in (optional) | No |

And locally: Node.js 20 or newer, and this repository cloned with
`npm install` already run.

Two things to know up front, because they shape the steps:

- **The repository targets Postgres.** `prisma/schema.prisma` declares
  `provider = "postgresql"` and the committed migration is Postgres SQL, so
  step 2 is a verification rather than a change. If you are working from an
  older checkout that still says `sqlite`, step 2 says what to do. Either way
  SQLite is not an option in production: Vercel's filesystem is read-only and
  ephemeral, so a `file:./dev.db` database would be empty on every cold start.
- **The first sync takes longer than a serverless function may run.** Model
  calls are serialized with a 6.5 second gap to stay inside the free tier, so
  triaging 50 reviews takes roughly 8 minutes against a 300 second function
  ceiling. Step 7 does that initial run from your machine instead. Incremental
  syncs after that are small and finish well inside the limit.

---

## Step 1 — Create the database

There are two ways to do this. **Option A is easier** and is what this project
was deployed with: Vercel provisions the database and injects the connection
strings into the project for you, so you never copy a URL by hand.

### Option A — Neon through the Vercel Marketplace (recommended)

1. In your Vercel project, go to **Storage → Create Database → Neon**, pick a
   region close to your users, and create it. No card.
2. That is the whole step. The integration sets these on the project
   automatically, for Production and Development:

   | Variable | What it is |
   | --- | --- |
   | `DATABASE_URL` | **Pooled** connection. What the app reads. |
   | `DATABASE_URL_UNPOOLED` | **Direct** connection. What migrations need. |
   | `POSTGRES_URL`, `PGHOST`, `PGUSER`, … | Aliases other tooling expects. Unused here. |

   The names line up with what this project already expects: the app reads
   `DATABASE_URL`, and `prisma.config.ts` picks up `DATABASE_URL_UNPOOLED` for
   migrations without any extra configuration.

3. Pull them to your machine so you can run migrations and the seed:

   ```bash
   npx vercel link
   npx vercel env pull .env.production.local --environment=production
   ```

   > **Both environments point at the same database branch** unless you create a
   > separate one. Local development and the deployment therefore share data.
   > That is fine for a demo; for anything real, create a Neon branch for
   > development and set `DATABASE_URL` for the Development environment to it.

   > Vercel writes several `.env*.local` files, and Next.js loads
   > `.env.development.local` ahead of `.env`. Two files defining `DATABASE_URL`
   > is a reliable way to spend an hour wondering why an edit does nothing.
   > Consolidate into `.env` and delete the pulled copies once you have the
   > values.

### Option B — Neon directly

1. Sign in to [neon.tech](https://neon.tech) and create a project. The free
   plan needs no card.
2. Choose a region close to where you will deploy the Vercel functions. A
   database in Frankfurt behind functions in Washington adds a round trip to
   every query.
3. From **Dashboard → Connect**, copy **two** connection strings:

| Which | Looks like | Used for |
| --- | --- | --- |
| **Pooled** | `...@ep-xxx-pooler.region.aws.neon.tech/...` | The running app (`DATABASE_URL` on Vercel) |
| **Direct** | `...@ep-xxx.region.aws.neon.tech/...` | Running migrations and the seed |

Both end in `?sslmode=require`. Keep it.

Use the **pooled** string for the deployed app: serverless functions open and
close connections constantly and the pooler is what stops that exhausting the
database. Use the **direct** string for migrations, because schema changes need
a session the pooler will not give them.

---

## Step 2 — Apply the schema

**2.1 — Confirm the datasource.** `prisma/schema.prisma` should read:

```prisma
datasource db {
  provider = "postgresql"
}
```

Nothing else in the schema is dialect-specific. It deliberately contains no
`enum` blocks and no scalar lists, which is what let it move off SQLite as a
one-line change. (Verified: the schema generates 48 DDL statements against
Postgres with no manual edits.)

**2.2 — Create the tables.** Against an empty database, apply the committed
migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` applies what is committed and nothing else, which is what you
want on a database you care about. It takes the direct connection from
`prisma.config.ts` on its own.

The connection is resolved for you: `prisma.config.ts` prefers
`DIRECT_DATABASE_URL`, then Vercel's `DATABASE_URL_UNPOOLED`, then
`POSTGRES_URL_NON_POOLING`, and falls back to `DATABASE_URL`. Put the direct URL
in `.env` as `DIRECT_DATABASE_URL` once and every later `prisma` command picks
the right connection on its own.

> **Coming from an older SQLite checkout?** If
> `prisma/migrations/migration_lock.toml` says `provider = "sqlite"`, that
> history is SQLite SQL — `DATETIME` columns, inline `PRIMARY KEY` — and Prisma
> will refuse to apply it to Postgres. Replace it once, against an empty
> database:
>
> ```bash
> rm -rf prisma/migrations
> npx prisma migrate dev --name init
> ```
>
> That writes a fresh migration in Postgres SQL, sets `migration_lock.toml` to
> `provider = "postgresql"`, and applies it.

**2.3 — Keep `prisma/migrations/` in version control.** Deployments apply
exactly what you tested and nothing else, which only works if it is committed.

> **One datasource, not two.** A single `migrations/` directory cannot hold both
> dialects, so local development runs on Postgres too. The cheapest way to get a
> local database is a **Neon branch** — free, isolated, and the same dialect as
> production. Pointing local development at the production database works, but
> then a stray `db:seed` writes to live data.

---

## Step 3 — Generate the secrets

Two random values. Generate them now and keep them somewhere you can paste from.

**`AUTH_SECRET`** — signs the session cookie. Anyone holding it can forge a
session.

```bash
npx auth secret
```

**`CRON_SECRET`** — the shared secret protecting `POST /api/cron/sync`.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The sync endpoint compares this in constant time and returns 401 on any
mismatch. If `CRON_SECRET` is unset on the server, **every** request is refused —
an unset secret never means an open endpoint.

---

## Step 4 — Get a Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. **Create API key**, and pick a Google Cloud project (or let it make one).
3. Copy it. This is `GOOGLE_GENERATIVE_AI_API_KEY`.

The free tier needs no billing account. Two things worth knowing before you rely
on it:

- **Quotas are per model, per day, and Google no longer publishes the numbers in
  its docs.** They are visible per account at [ai.dev/rate-limit](https://ai.dev/rate-limit).
- **They are smaller than you would guess.** `gemini-3.5-flash` allows **20
  requests per day** on the free tier — measured here, not estimated. That is
  why generation runs on `gemini-3.5-flash-lite` and the classifier on
  `gemini-3.1-flash-lite`: different models have separate quota pools, so
  classification cannot eat the drafting budget.

The app reads the real limit out of the first `429` it receives and budgets
against that from then on, so a wrong guess in configuration fails safe rather
than turning into an afternoon of retries.

**Without this key the app still runs.** Template replies and keyword
escalations work exactly as normal because neither calls a model. Reviews that
need a written reply are shown as waiting rather than given an invented draft.

---

## Step 5 — Set up Google sign-in (optional)

Skip this if email-and-password sign-in is enough; the app works fully without
it. `/signin` detects that the variables are missing and explains itself rather
than showing a button that cannot work.

1. In [console.cloud.google.com](https://console.cloud.google.com), create or
   select a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Fill in the app name, a support email, and a developer contact email
   - Scopes: leave the defaults. This app requests only
     `openid email profile`.
3. **Publishing status.** While the app is in *Testing*, only accounts listed
   under **Test users** can sign in, and they see an "unverified app" warning.
   That is fine for a demo. To let anyone sign in, click **Publish app** — with
   these basic scopes no Google review is required.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorised redirect URIs** — add every origin the app will answer on:

     ```
     http://localhost:3000/api/auth/callback/google
     https://your-app.vercel.app/api/auth/callback/google
     https://your-custom-domain.com/api/auth/callback/google
     ```

     The path must be exactly `/api/auth/callback/google`. A missing or
     mistyped URI is the cause of almost every `redirect_uri_mismatch`.
5. Copy the **Client ID** into `AUTH_GOOGLE_ID` and the **Client secret** into
   `AUTH_GOOGLE_SECRET`.

> Vercel gives every deployment its own preview URL, and you cannot pre-register
> them all. Either add redirect URIs for the previews you actually use, or accept
> that Google sign-in works on production and localhost only. Email sign-in works
> everywhere.

**This does not give the app access to reviews.** Reading and replying to a
Google Business Profile needs the restricted `business.manage` scope and an
approved API access request. See
[the README](README.md#the-google-business-profile-constraint) for what that
involves and what changes when it arrives.

---

## Step 6 — Deploy to Vercel

**6.1 — Import the repository.** In Vercel, **Add New → Project**, import the
repo. It detects Next.js; leave the build settings alone. `prisma generate` runs
automatically via the `postinstall` script, so the Prisma client is built during
install.

**6.2 — Set the environment variables** before the first deploy, under
**Settings → Environment Variables**. Apply each to **Production** and
**Preview**:

| Variable | Value | Required |
| --- | --- | --- |
| `DATABASE_URL` | The Neon **pooled** connection string. Already set if you used the Vercel integration in step 1 — do not add it twice. | Yes |
| `AUTH_SECRET` | From step 3 | Yes |
| `CRON_SECRET` | From step 3 | Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | From step 4 | For AI drafts |
| `AUTH_GOOGLE_ID` | From step 5 | For Google sign-in |
| `AUTH_GOOGLE_SECRET` | From step 5 | For Google sign-in |
| `REVIEW_PROVIDER` | `fake` | Yes |
| `SYNC_CADENCE_LABEL` | `Every six hours, plus whenever you ask` | No |

`REVIEW_PROVIDER` stays `fake` until you have Business Profile API access.
Setting it to `google` before then makes every sync fail loudly with a
`NotImplementedError` naming the missing access — which is deliberate, so it can
never quietly serve synthetic data while looking connected.

`AUTH_URL` is **not** needed on Vercel; Auth.js detects the deployment URL. On
any other host, set `AUTH_URL` to the canonical public URL and
`AUTH_TRUST_HOST=true`.

**6.3 — Deploy**, and note the production URL.

**6.4 — If you use a custom domain**, add it in Vercel, then go back to step 5
and add its callback URL to the Google OAuth client.

---

## Step 7 — Create the first account

The database is empty at this point: migrated, but with no organization, user or
location in it. Pick one of these.

### Option A — Google sign-in (recommended for a real deployment)

Visit `https://your-app.vercel.app/signin` and click **Continue with Google**.
Signing in provisions an organization, and onboarding then creates the locations
and runs the first sync.

Onboarding runs that first sync inline in a server action, so on a fresh
deployment it may exceed the function timeout. If the page hangs, it has not
broken anything: reviews are ingested and any that were not triaged carry no
route yet, so the next sync picks them up exactly where it stopped. Trigger it
from **Sync now**, or wait for the schedule.

### Option B — Seed the demo tenant from your machine

This creates the `Corner Table Bistro` organization, both locations, and the 50
synthetic reviews, running the whole pipeline. Do it locally against the
production database so it is not fighting a function timeout:

```bash
# Takes several minutes: model calls are rate-limited to stay inside the free
# tier. DEMO_PASSWORD is what keeps the published default off a public URL.
# Generate a password you can read back, then seed with it.
node -e "console.log(require('crypto').randomBytes(15).toString('base64url'))"

DEMO_PASSWORD="the-password-you-just-generated" npm run db:seed
```

It reads `DATABASE_URL` and `GOOGLE_GENERATIVE_AI_API_KEY` from your `.env`. The
seed prints `(set from DEMO_PASSWORD)` instead of the password itself, so
generate it somewhere you can read it back, or set a value you have chosen.

> ### Change the demo password before exposing this publicly
>
> The seed creates `demo@cornertable.com` with the password `reviewdesk2026`,
> and that pair is written in this repository's README. On a public URL it is an
> open door.
>
> Set the `DEMO_PASSWORD` environment variable when you run the seed, as above.
> To change it after the fact, hash a new one:
>
> ```bash
> node -e "require('bcryptjs').hash('your-new-password', 10).then(console.log)"
> ```
>
> then update that user's `passwordHash` in the Neon SQL editor:
>
> ```sql
> UPDATE "User" SET "passwordHash" = '<the hash>'
> WHERE email = 'demo@cornertable.com';
> ```
>
> There is no self-service registration and no password reset flow — both are
> out of scope, and both are listed as such in the README. Accounts come from
> Google sign-in or from the seed.

---

## Step 8 — Schedule the sync

The workflow is already in the repository at `.github/workflows/sync.yml`, set to
every six hours.

**Why GitHub Actions and not Vercel Cron:** Vercel's Hobby plan permits cron jobs
at a **once-per-day** frequency only, which is too coarse for a review queue.
Actions is free at any frequency and exercises the same authenticated
external-trigger path.

**8.1 — Add two repository secrets** under **Settings → Secrets and variables →
Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `APP_URL` | `https://your-app.vercel.app` (no trailing slash) |
| `CRON_SECRET` | Exactly the value you set on Vercel |

**8.2 — Test it without waiting six hours.** Go to **Actions → Scheduled review
sync → Run workflow**. The run summary shows the JSON the endpoint returned.

**8.3 — To change the frequency**, edit the cron expression in the workflow:

```yaml
on:
  schedule:
    - cron: "0 */6 * * *"   # every six hours, UTC
```

**To use Vercel Cron instead**, add `vercel.json` and accept the daily ceiling:

```json
{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 3 * * *" }] }
```

Whichever you choose, **Sync now** in the app always works, and the inbox shows
how long ago the last successful sync finished.

---

## Verification checklist

Run through this once. Each line has a definite pass or fail.

```bash
# 1. The endpoint refuses an unauthenticated request.
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://your-app.vercel.app/api/cron/sync
# expect: 401

# 2. It accepts the secret, and reports how many locations it can see.
curl -s -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/cron/sync
# expect: {"ok":true,"locations":2,"lastSuccessfulSync":"...","lastTrigger":"..."}

# 3. A full sync is idempotent: run it twice, the second is a no-op.
curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/cron/sync
# expect: every result with reviewsCreated: 0 and generated: 0
```

Then, in the browser:

- [ ] `/inbox` while signed out redirects to `/signin`
- [ ] Signing in lands on `/inbox` with reviews in it
- [ ] A wrong password shows *"That email and password don't match an account"*
- [ ] The inbox shows escalated reviews as black slabs with no draft
- [ ] Opening a generated draft shows themes and the brand voice
- [ ] **Approve and publish** moves the review to Published, and `/activity`
      records where the reply went — with the synthetic provider it says
      *"No reply was sent to Google"*
- [ ] `/settings` shows today's AI usage against the daily budget
- [ ] Switching location in the sidebar changes the queue

---

## Environment variables in full

### Required

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL in the app. `lib/db.ts` picks the driver from the prefix: `file:` uses SQLite, anything else uses Postgres. |
| `AUTH_SECRET` | `npx auth secret`. Rotating it signs everyone out. |
| `CRON_SECRET` | Must match the GitHub Actions secret exactly. Unset means *all* requests are refused. |

### Strongly recommended

| Variable | Notes |
| --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Without it, no AI drafts and no classifier. Templates and keyword escalations still work. |
| `REVIEW_PROVIDER` | `fake` (default) or `google`. Leave on `fake` until API access is granted. |

### Optional

| Variable | Default | Notes |
| --- | --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | Enables Google sign-in. |
| `AUTH_URL` | auto | Only needed off Vercel. |
| `AUTH_TRUST_HOST` | — | Set `true` when hosting outside Vercel. |
| `SYNC_CADENCE_LABEL` | `Every six hours, plus whenever you ask` | The schedule as the UI describes it. Change it if you change the cron. |
| `DIRECT_DATABASE_URL` | falls back to `DATABASE_URL` | Direct (non-pooled) connection for `prisma migrate`. Vercel's `DATABASE_URL_UNPOOLED` is accepted too. |
| `DEMO_PASSWORD` | `reviewdesk2026` | Password for the seeded demo account. Always set it for a public deployment. |
| `DEMO_EMAIL` | `demo@cornertable.com` | Email for the seeded demo account. |
| `AI_DAILY_BUDGET_GENERATION` | `150` | Starting point only; a `429` overrides it with the real number. |
| `AI_DAILY_BUDGET_CLASSIFIER` | `150` | Same. |
| `AI_MIN_DELAY_MS` | `6500` | Minimum gap between model calls, about 9 per minute. |
| `AI_MAX_RETRIES` | `4` | Retries on 429 and 5xx. |
| `AI_RETRY_BASE_MS` / `AI_RETRY_MAX_MS` | `2000` / `32000` | Backoff floor and ceiling. |
| `AI_TIMEOUT_MS` | `30000` | Per-call timeout. |
| `AI_ESCALATION_THRESHOLD` | `0.4` | Classifier confidence at which a review escalates. Low on purpose. |

`.env.example` carries the same list with fuller commentary.

---

## Free-tier limits and what happens when you hit them

| Service | Limit | What the app does |
| --- | --- | --- |
| Gemini `gemini-3.5-flash-lite` (generation) | Per-day quota, per model | Stops generating, shows *"AI drafts paused — daily limit reached, resuming at midnight Pacific"*, keeps template routing running |
| Gemini `gemini-3.1-flash-lite` (classifier) | Separate per-day quota | Reviews are reported as unscreened and picked up by the next sync — they are **not** escalated, because a check that could not run is not a failed check |
| Neon free | 0.5 GB, suspends when idle | First request after idle takes an extra second |
| Vercel Hobby | 300s per function; cron once per day | Hence GitHub Actions; a long sync resumes on the next run |
| GitHub Actions | Free on public repos | — |

The daily Gemini quota resets at **midnight Pacific**, not UTC. The usage counter
is keyed by the Pacific date and the UI quotes Pacific, so the pause lifts when
the quota actually does.

A sync that is cut short by a function timeout loses nothing. Reviews are
ingested first and triaged second, and a review with no route yet is exactly what
the next sync looks for.

---

## Security notes and known limitations

Stated plainly so they are decisions rather than surprises.

- **Sign-in rate limiting is in-process.** `lib/auth/rate-limit.ts` holds failed
  attempts in memory. Across serverless instances that means the effective limit
  is per instance, and it resets on cold start. It stops casual grinding, not a
  determined distributed attempt. A shared store would mean adding
  infrastructure this project needs for nothing else.
- **`allowDangerousEmailAccountLinking` is on** for the Google provider. A Google
  account links to an existing user with the same address without a separate
  verification step. Google verifies the addresses it asserts, so the practical
  risk is low — but if you later add an unverified identity provider, turn this
  off first.
- **No email verification and no password reset.** Out of scope, and listed as
  such in the README. Plan for that if real customers sign up.
- **The demo credentials are in the README.** Change or remove that account
  before a public deployment. See step 7.
- **Publishing does not reach Google** while `REVIEW_PROVIDER=fake`. The app says
  so on the review screen and in the activity log rather than implying otherwise.
- **Every query is scoped by the organization on the session**, never by a value
  from the request. That is enforced in one place, `lib/tenancy.ts`. Route it
  through there if you add queries.
- **Rotate `AUTH_SECRET` and `CRON_SECRET`** if they ever appear in a log, a
  screenshot, or a shared terminal.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `The datasource provider 'postgresql' does not match the one in migration_lock.toml` | Migration history left over from a SQLite checkout | Step 2.2 — delete `prisma/migrations` and regenerate |
| `FATAL: terminating connection due to administrator command` (57P01) | Neon suspends an idle compute and the first connection wakes it | Retry. Not a failure. |
| `Error validating datasource: the URL must start with protocol file:` | `provider` is still `sqlite` | Step 2.1 |
| Build fails on `@prisma/client did not initialize yet` | `prisma generate` did not run | Confirm the `postinstall` script survived; redeploy |
| `redirect_uri_mismatch` from Google | Callback URL not registered | Step 5.4 — it must be exactly `/api/auth/callback/google` on that exact origin |
| Google sign-in says the app is unverified | Consent screen is in *Testing* | Add the account under Test users, or publish the app |
| Sign-in loops back to `/signin` | `AUTH_SECRET` missing, or `AUTH_URL`/`AUTH_TRUST_HOST` unset off Vercel | Step 3 and step 6.2 |
| Cron returns 401 | `CRON_SECRET` differs between Vercel and GitHub | Re-paste both; no trailing whitespace |
| Cron times out on the first run | The initial triage is longer than the function limit | Expected. Re-run it, or seed from your machine (step 7) |
| Inbox shows *"AI drafts are off"* | No `GOOGLE_GENERATIVE_AI_API_KEY` on the deployment | Step 4, then **Sync now** |
| Inbox shows *"AI drafts paused"* | Daily quota spent | Wait for midnight Pacific, or raise the budget if your account allows more |
| Reviews sit as *"Waiting to be screened"* | The classifier could not run when they were synced | Correct behaviour. The next sync picks them up |
| Everything is suddenly escalated | A classifier that runs and fails escalates by design | Check the activity log for the failure reason |
| `Too many connections` from Neon | Using the direct URL in the app | Use the **pooled** URL for `DATABASE_URL` on Vercel |

---

## Going further: real Google reviews

Everything above deploys the app against synthetic review data, which is what it
is designed to run on today. The checklist for swapping in the real Google
Business Profile provider — API access, the restricted scope, token refresh, and
the three methods to implement — is in
[the README](README.md#swapping-in-the-real-provider). No file outside
`lib/providers/` changes.
