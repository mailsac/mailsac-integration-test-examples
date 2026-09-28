// End-to-end signup verification: sign up with a fresh address, wait for the
// verification email, then confirm the account with the link and with the code.
import { test, expect } from '@playwright/test';
import { testInbox } from './inbox';

const inbox = testInbox();

test.describe('signup verification email', () => {
  test('arrives and its link verifies the account', async ({ page }) => {
    const address = inbox.newAddress('signup-link');

    await page.goto('/');
    await page.getByLabel('Email').fill(address);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    const email = await inbox.waitForEmail(address, { subject: 'Confirm your email address' });
    // assert on content, not only on arrival
    expect(email.text).toContain('Confirm your email address');
    const link = email.links.find((l) => l.includes('/verify?token='));
    expect(link, 'verification link in the email').toBeTruthy();

    await page.goto(link!);
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
    await expect(page.getByText(address)).toBeVisible();

    await inbox.cleanup(address, email.id);
  });

  test('arrives with a 6-digit code that verifies the account', async ({ page }) => {
    const address = inbox.newAddress('signup-code');

    await page.goto('/');
    await page.getByLabel('Email').fill(address);
    await page.getByRole('button', { name: 'Sign up' }).click();

    const email = await inbox.waitForEmail(address, { subject: 'Confirm your email address' });
    const code = email.text.match(/\b(\d{6})\b/)?.[1];
    expect(code, '6-digit code in the email').toMatch(/^\d{6}$/);

    await page.getByLabel('6-digit code').fill(code!);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();

    await inbox.cleanup(address, email.id);
  });
});
