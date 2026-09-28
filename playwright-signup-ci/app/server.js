// A deliberately small signup app. It stands in for your application: on signup it
// sends a verification email with a link and a 6-digit code over SMTP. Point SMTP_* at
// your real email provider, at Mailsac Email Capture, or at Mailpit in CI.
const crypto = require('node:crypto');
const express = require('express');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.PORT || 3000);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const MAIL_FROM = process.env.MAIL_FROM || 'Example App <no-reply@example.com>';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  // true for port 465 (implicit TLS); false upgrades with STARTTLS when the server offers it
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

// In-memory store: token -> { email, code, verified }
const pending = new Map();

const app = express();
app.use(express.urlencoded({ extended: false }));

const page = (title, body) => `<!doctype html><html><head><title>${title}</title></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`;
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

app.get('/', (req, res) => {
  res.send(page('Create an account', `
    <form method="post" action="/signup">
      <label>Email <input type="email" name="email" required></label>
      <button type="submit">Sign up</button>
    </form>`));
});

app.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim();
    const token = crypto.randomBytes(16).toString('hex');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    pending.set(token, { email, code, verified: false });

    const link = `${APP_URL}/verify?token=${token}`;
    await transport.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Confirm your email address',
      text: `Welcome!\n\nConfirm your email address: ${link}\n\nOr enter this code: ${code}\n`,
      html: `<p>Welcome!</p><p><a href="${link}">Confirm your email address</a></p>
             <p>Or enter this code: <strong>${code}</strong></p>`,
    });

    res.send(page('Check your email', `
      <p>We sent a confirmation link and code to ${escape(email)}.</p>
      <form method="post" action="/verify-code">
        <input type="hidden" name="token" value="${token}">
        <label>6-digit code <input name="code" inputmode="numeric" required></label>
        <button type="submit">Verify</button>
      </form>`));
  } catch (err) {
    next(err);
  }
});

const verified = (res, email) => res.send(page('Email verified', `<p>Your email ${escape(email)} is verified.</p>`));

app.get('/verify', (req, res) => {
  const entry = pending.get(String(req.query.token || ''));
  if (!entry) return res.status(400).send(page('Invalid link', '<p>This link is invalid or expired.</p>'));
  entry.verified = true;
  verified(res, entry.email);
});

app.post('/verify-code', (req, res) => {
  const entry = pending.get(String(req.body.token || ''));
  if (!entry || entry.code !== String(req.body.code || '').trim()) {
    return res.status(400).send(page('Invalid code', '<p>That code is not correct.</p>'));
  }
  entry.verified = true;
  verified(res, entry.email);
});

app.listen(PORT, () => console.log(`Example app listening on ${APP_URL}`));
