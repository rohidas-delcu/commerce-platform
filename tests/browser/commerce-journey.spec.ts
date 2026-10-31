import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

const adminBase = 'http://localhost:5173';
const shopBase = 'http://localhost:5174';
const handle = process.env.COMMERCE_E2E_STORE_HANDLE ?? 'delcu-trail-supply';
const shop = `${shopBase}/s/${handle}`;

type Credentials = { merchantEmail: string; customerEmail: string; password: string; storeHandle: string };
async function demoCredentials(): Promise<Credentials> {
  const path = process.env.COMMERCE_E2E_CREDENTIALS_PATH;
  if (!path) throw new Error('The disposable demo did not provide a private credentials path.');
  return JSON.parse(await readFile(path, 'utf8')) as Credentials;
}

async function mailToken(email: string) {
  const directory = process.env.COMMERCE_E2E_MAIL_DIR;
  if (!directory) throw new Error('The disposable demo did not provide a private mail directory.');
  for (let attempt = 0; attempt < 120; attempt++) {
    for (const name of (await readdir(directory)).filter(name => name.startsWith('identity_') && name.endsWith('.json'))) {
      let message: { to: string; text: string };
      try { message = JSON.parse(await readFile(join(directory, name), 'utf8')) as typeof message; }
      catch { continue; } // The worker may still be finishing a local file.
      if (message.to !== email) continue;
      const link = message.text.match(/https?:\/\/localhost:517[34]\/[^\s]+/)?.[0];
      const token = link ? new URL(link).searchParams.get('token') : null;
      if (token) return token;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('No locally delivered email-verification challenge was found for this test identity.');
}

async function loginMerchant(page: Page, email: string, password: string) {
  await page.goto(`${adminBase}/login`);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
}

test('merchant signs up, verifies email, and completes initial store creation', async ({ page }) => {
  const { password } = await demoCredentials();
  const suffix = randomUUID().slice(0, 12);
  const email = `merchant-browser-${suffix}@example.test`;
  await page.goto(`${adminBase}/signup`);
  await expect(page.getByRole('heading', { name: 'Start your own store' })).toBeVisible();
  await page.getByLabel('Full name').fill('Browser Merchant');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByLabel('One-time email token').fill(await mailToken(email));
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Set up a store' })).toBeVisible();
  await page.getByLabel('Business / account name').fill(`Browser Merchant ${suffix}`);
  await page.getByLabel('Store name', { exact: true }).fill('Browser Workshop');
  await page.getByLabel('Store handle').fill(`browser-workshop-${suffix}`);
  await page.getByRole('button', { name: 'Create store & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Store settings' })).toBeVisible();
  await expect(page.getByText('Store is not published yet')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('public guest cart, verified customer signup, COD checkout, merchant delivery, and private receipt', async ({ page, browser }) => {
  const { merchantEmail, customerEmail: otherCustomer, password } = await demoCredentials();
  const email = `customer-browser-${randomUUID().slice(0, 12)}@example.test`;

  await test.step('Public product discovery and guest cart', async () => {
    await page.goto(shop);
    await expect(page.getByRole('heading', { name: 'The collection' })).toBeVisible();
    await page.locator('.product-card').filter({ hasText: 'Everyday Trail Backpack' }).click();
    await expect(page.getByRole('heading', { name: 'Everyday Trail Backpack' })).toBeVisible();
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByText('Added to your bag.')).toBeVisible();
    await page.getByRole('link', { name: 'View your bag' }).click();
    await expect(page.getByRole('heading', { name: /Shopping bag/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Everyday Trail Backpack' })).toBeVisible();
    await page.getByRole('link', { name: 'Continue to checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  });

  await test.step('Customer creates a verified account and the guest bag is merged', async () => {
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByLabel('Full name').fill('Browser Customer');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('New password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await page.getByLabel('Email token').fill(await mailToken(email));
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page.getByText('Email verified. You can now sign in.')).toBeVisible();
    await page.getByRole('link', { name: 'Sign in after verification' }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible();
    await expect(page.getByText('Everyday Trail Backpack')).toBeVisible();
  });

  let orderUrl = '';
  await test.step('Server-reserved quote and cash-on-delivery placement', async () => {
    await page.getByLabel('Address line 1').fill('18 Test Lane');
    await page.getByLabel('City').fill('Pune');
    await page.getByLabel('State / region').fill('Maharashtra');
    await page.getByLabel('Postal code').fill('411001');
    await page.getByLabel('Contact phone').fill('+919999999998');
    await expect(page.getByText('Standard shipping')).toBeVisible();
    await page.getByRole('button', { name: 'Review final order' }).click();
    await expect(page.getByRole('heading', { name: 'Almost yours.' })).toBeVisible();
    await expect(page.getByText('Cash on delivery')).toBeVisible();
    await page.getByRole('button', { name: 'Place COD order' }).click();
    await expect(page.getByRole('heading', { name: /^Order #/ })).toBeVisible();
    await expect(page.locator('.order-statuses')).toContainText('DUE');
    orderUrl = page.url();
    expect(orderUrl).toMatch(/\/account\/orders\/[0-9a-f-]{36}$/);
  });

  await test.step('Another customer cannot view this receipt', async () => {
    const otherContext = await browser.newContext();
    try {
      const other = await otherContext.newPage();
      await other.goto(orderUrl);
      await expect(other.getByRole('heading', { name: 'Sign in to view this order' })).toBeVisible();
      await other.goto(`${shop}/account/login`);
      await other.getByLabel('Email address').fill(otherCustomer);
      await other.getByLabel('Password', { exact: true }).fill(password);
      await other.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(other.getByRole('heading', { name: 'Order history' })).toBeVisible();
      await other.goto(orderUrl);
      await expect(other.getByRole('heading', { name: 'Order not found' })).toBeVisible();
    } finally { await otherContext.close(); }
  });

  await test.step('Merchant accepts, dispatches, and records COD collection', async () => {
    const merchantContext = await browser.newContext();
    try {
      const merchant = await merchantContext.newPage();
      await loginMerchant(merchant, merchantEmail, password);
      await merchant.getByRole('link', { name: 'Orders', exact: true }).click();
      await expect(merchant.getByRole('heading', { name: 'Orders' })).toBeVisible();
      await merchant.getByLabel('Search orders').fill(email);
      const row = merchant.getByRole('row').filter({ hasText: email });
      await expect(row).toHaveCount(1);
      await row.getByRole('button', { name: 'View order' }).click();
      const drawer = merchant.getByRole('dialog', { name: 'Order details' });
      await expect(drawer).toContainText(email);
      await drawer.getByRole('button', { name: 'Mark ready' }).click();
      await expect(drawer.getByRole('button', { name: 'Dispatch order' })).toBeVisible();
      await drawer.getByLabel('Carrier (optional)').fill('Manual browser delivery');
      await drawer.getByLabel('Tracking reference (optional)').fill('BROWSER-E2E-001');
      await drawer.getByRole('button', { name: 'Dispatch order' }).click();
      await expect(drawer.getByRole('button', { name: 'Mark delivered' })).toBeVisible();
      await drawer.getByRole('button', { name: 'Mark delivered' }).click();
      await expect(drawer.getByRole('button', { name: 'Confirm cash received' })).toBeVisible();
      merchant.once('dialog', dialog => dialog.accept());
      await drawer.getByRole('button', { name: 'Confirm cash received' }).click();
      await expect(drawer).toContainText('PAID');
    } finally { await merchantContext.close(); }
  });

  await test.step('Customer receipt reflects completed fulfillment and paid COD', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Order #/ })).toBeVisible();
    await expect(page.locator('.order-statuses')).toContainText('DELIVERED');
    await expect(page.locator('.order-statuses')).toContainText('PAID');
    await expect(page.getByText('Manual browser delivery')).toBeVisible();
  });
});
