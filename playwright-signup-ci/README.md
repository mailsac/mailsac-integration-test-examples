# Email testing in CI/CD: verify signup emails end to end

A complete, runnable example of testing a **signup verification email** in a CI/CD pipeline.
A Playwright test signs up with a fresh inbox address, waits for the verification email,
checks its content, then confirms the account with the **link** and with the **6-digit code**.
The same pattern covers password resets, magic links and one-time codes.

It runs in **GitHub Actions** and **GitLab CI** with two layers:

| Layer | Runs | What it proves | Inbox |
|---|---|---|---|
| Local SMTP catcher | every pull request | the app sends the right email with a working link and code | [Mailpit](https://mailpit.axllent.org) service container |
| Hosted test inbox | on `main`, nightly, or every PR | the email really arrives through your provider, DNS and sending domain | [Mailsac](https://mailsac.com) REST API |

The local layer is fast and never leaves CI. The hosted layer catches what a local catcher
can't: expired email-provider credentials, SPF/DKIM or DNS mistakes, a throttled or blocked
sending domain, and templates that only break in production.

## How it works

```
Playwright test ──► your app ──SMTP──► email provider / Mailsac Email Capture / Mailpit
      ▲                                              │
      └──────── Mailsac REST API (or Mailpit API) ◄──┘
```

1. `inbox.newAddress()` creates a unique address per test, e.g. `signup-link-mulu72uk-e3dd48fa@mailsac.com`,
   so parallel tests and re-runs never read each other's mail.
2. The test signs up in the browser.
3. `inbox.waitForEmail()` polls `GET /api/addresses/{email}/messages` with the `Mailsac-Key`
   header until the message arrives (60 s timeout), then reads it with `GET /api/text/{email}/{messageId}`.
4. The test extracts the verification link and code, completes the flow, and deletes the message.

The code is in [`tests/inbox.ts`](tests/inbox.ts) (about 100 lines, no SDK needed) and
[`tests/signup.spec.ts`](tests/signup.spec.ts). The app in [`app/server.js`](app/server.js)
stands in for yours.

## Run it

```bash
cd playwright-signup-ci
npm ci
npx playwright install chromium
```

**With Mailpit (no account needed):**

```bash
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
INBOX=mailpit SMTP_HOST=localhost SMTP_PORT=1025 npx playwright test
```

**With Mailsac:** create a free account at [mailsac.com](https://mailsac.com/register) and an
API key, then send through [Email Capture](https://docs.mailsac.com/en/latest/services/email_capture/email_capture.html),
which keeps every message in Mailsac instead of delivering it:

```bash
export MAILSAC_API_KEY=...            # your API key
export SMTP_HOST=capture.mailsac.com SMTP_PORT=5587 SMTP_USER=your-mailsac-username SMTP_PASS=$MAILSAC_API_KEY
npx playwright test
```

**Against your deployed app (real delivery):** point the test at staging, which sends through
your real email provider to a Mailsac inbox:

```bash
APP_URL=https://staging.example.com MAILSAC_API_KEY=... npx playwright test
```

## CI setup

- **GitHub Actions** ([`.github/workflows/playwright-signup-ci.yml`](../.github/workflows/playwright-signup-ci.yml) in this repository; in your own project, save it as `.github/workflows/email-tests.yml` without the `working-directory` default):
  add the repository secret `MAILSAC_API_KEY` and the variables `MAILSAC_USERNAME`
  (for Email Capture) and `STAGING_URL` (for the nightly real-delivery job). Jobs without their
  settings skip themselves, so the Mailpit job works on a fresh fork.
- **GitLab CI** ([`.gitlab-ci.yml`](.gitlab-ci.yml), copy it to your project root): set `MAILSAC_API_KEY` (masked),
  `MAILSAC_USERNAME` and `STAGING_URL` as CI/CD variables; schedule a pipeline for real delivery.

## Public inboxes vs a private test domain

Addresses at `@mailsac.com` are free, need no setup and accept mail immediately, but anyone who
guesses the address can read them, so send only made-up data. For real signups on staging or
production, use a private domain: your own subdomain (e.g. `test.example.com`) or a zero-setup
`yourteam.msdc.co` subdomain. Set `MAILSAC_DOMAIN` and nothing else changes.

## Tips for reliable email tests

- **One address per test.** Never reuse a shared inbox across tests or runs.
- **Poll with a timeout** instead of sleeping. Most messages arrive in seconds; allow up to a minute for real delivery.
- **Assert on content**, not only arrival: subject, link host, code format, unsubscribe footer.
- **Clean up** messages after each test, and keep real-delivery checks on a schedule rather than every commit.
- **Prefer push for long waits:** Mailsac can also deliver each email to a [webhook or WebSocket](https://docs.mailsac.com).

## Other frameworks

- Cypress: [`@mailsac/cypress`](https://www.npmjs.com/package/@mailsac/cypress)
- Playwright guide: [blog.mailsac.com/playwright-email-testing](https://blog.mailsac.com/playwright-email-testing/)
- Email testing API overview: [mailsac.com/pages/email-testing-api](https://mailsac.com/pages/email-testing-api/)
- REST API reference: [mailsac.com/docs/api](https://mailsac.com/docs/api)

## License

MIT
