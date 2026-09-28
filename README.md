# Mailsac email testing examples

Runnable examples of testing the emails your app sends (signup verification, password reset,
magic links, one-time codes) in integration tests and CI/CD pipelines, using
[Mailsac](https://mailsac.com) test inboxes and its REST API.

| Example | Stack | What it shows |
|---|---|---|
| [`playwright-signup-ci/`](playwright-signup-ci/) | Playwright, GitHub Actions, GitLab CI | End-to-end signup verification in CI: sign up with a fresh inbox, wait for the email, confirm with the link and the 6-digit code. A local SMTP catcher (Mailpit) on every pull request, Mailsac Email Capture and a real-delivery check against staging. |
| [`test/`](test/) (repository root) | Node.js, Mocha | Check that an email arrived with a specific link, once through the REST API ([`test/test.js`](test/test.js)) and once through the realtime WebSocket API ([`test/websocket.js`](test/websocket.js)). |

## Mocha example (repository root)

In one test, Mailsac's REST API is used to check whether an email was received with a specific
URL link in the email body. In the other test, Mailsac's realtime Web Socket API is used for
the same purpose.

## More

- Email testing API overview: https://mailsac.com/pages/email-testing-api/
- Cypress plugin: [`@mailsac/cypress`](https://www.npmjs.com/package/@mailsac/cypress)
- Playwright guide: https://blog.mailsac.com/playwright-email-testing/
- Documentation: https://docs.mailsac.com
