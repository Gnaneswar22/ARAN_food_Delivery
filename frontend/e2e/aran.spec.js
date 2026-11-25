import { expect, test } from '@playwright/test';

const API = 'http://localhost:5000/api/v1';
const OWNER = { identifier: 'owner@aran.local', password: 'Aran@12345' };


/** Signs in through the on-page OTP form. In dev the API has no SMS provider, so the UI shows the code. */
async function otpLogin(page, phone, name) {
  await page.getByLabel('Mobile number').first().fill(phone);
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const hint = await page.getByText(/Your code is/).textContent();
  await page.getByLabel('Digit 1').fill(hint.match(/\d{6}/)[0]);
  if (name) { await page.getByLabel('Your name').fill(name); await page.getByRole('button', { name: 'Continue' }).click(); }
}
test.beforeAll(async ({ request }) => {
  // Make the store open at any time and delivery serviceable for the test PIN code.
  const { data } = await (await request.post(`${API}/auth/admin/login`, { data: OWNER })).json();
  await request.put(`${API}/admin/settings`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
    data: { timings: { open: '00:00', close: '23:59', acceptingOrders: true, temporaryClosure: false, weeklyHolidays: [] }, delivery: { pincodes: ['411001'], minOrderPaise: 10000 } },
  });
});

test('homepage shows dynamic categories and featured products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good Food/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Burgers/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Featured dishes' })).toBeVisible();
});

test('menu search + add to cart + quantity update', async ({ page }) => {
  await page.goto('/menu?q=margherita');
  await expect(page.getByRole('heading', { name: 'Margherita' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Margherita to cart' }).click();
  await expect(page.getByText('Margherita added to cart')).toBeVisible();
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByText('₹518').first()).toBeVisible(); // 2 × 259
});

test('coupon is validated by the server', async ({ page }) => {
  await page.goto('/menu?q=margherita');
  await page.getByRole('button', { name: 'Add Margherita to cart' }).click();
  await page.goto('/cart');
  await page.getByPlaceholder('Enter code').fill('NOPE');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Invalid coupon code')).toBeVisible();
  await page.getByPlaceholder('Enter code').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('WELCOME10 applied')).toBeVisible();
});

test('guest pickup COD order → admin accepts → customer sees update', async ({ page, browser }) => {
  await page.goto('/menu?q=garlic');
  await page.getByRole('button', { name: 'Add Garlic Bread to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: /Pickup from ARAN.co/ }).click();
  await expect(page.getByText('Verify your mobile number')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Pay .\d|Place order)/ })).toBeDisabled();
  await otpLogin(page, '98765' + String(Date.now()).slice(-5), 'E2E Guest');
  await page.getByLabel('Full name').fill('E2E Guest');
  await page.getByRole('button', { name: /Cash on delivery/ }).click();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByRole('heading', { name: /Order ARN/ })).toBeVisible();
  await expect(page.getByText('We have received your order.')).toBeVisible();

  const admin = await browser.newPage({ baseURL: 'http://localhost:5173' });
  await admin.goto('/admin/login');
  await admin.getByLabel('Email or mobile number').fill(OWNER.identifier);
  await admin.getByLabel('Password').fill(OWNER.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.getByRole('link', { name: 'Orders' }).first().click();
  await admin.screenshot({ path: 'test-results/admin-orders.png' });
  await admin.getByRole('row', { name: /E2E Guest/ }).first().click();
  await admin.getByRole('button', { name: 'Accept order' }).click();
  await expect(page.getByText('ARAN.co has accepted your order.')).toBeVisible({ timeout: 15000 }); // via socket/poll
  await admin.close();
});

test('delivery outside service area is blocked with a pickup suggestion', async ({ page }) => {
  await page.goto('/menu?q=classic');
  await page.getByRole('button', { name: 'Add Classic ARAN Burger to cart' }).click();
  await page.goto('/checkout');
  await page.getByLabel('Address line 1').fill('12 Test Street');
  await page.getByLabel('City').fill('Pune');
  await page.getByLabel('PIN code').fill('999999');
  await expect(page.getByText(/do not deliver to this PIN/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Pay .\d|Place order)/ })).toBeDisabled();
});

test('mobile OTP sign-up and login', async ({ page }) => {
  await page.goto('/login');
  await otpLogin(page, '97654' + String(Date.now()).slice(-5), 'E2E User');
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole('heading', { name: /Hi, E2E/ })).toBeVisible();
  await expect(page.getByText('✓ Verified by OTP')).toBeVisible();
});

test('wrong OTP is rejected with attempts left', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Mobile number').first().fill('96543' + String(Date.now()).slice(-5));
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await page.getByLabel('Digit 1').fill('000000');
  await expect(page.getByText(/Incorrect code\. 4 attempts left/)).toBeVisible();
});
test('admin area rejects anonymous users', async ({ page }) => {
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/admin\/login/);
});

for (const width of [320, 375, 768, 1280]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/menu', '/cart', '/login']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test('PWA manifest is valid and installable', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await request.get(new URL(href, page.url()).toString())).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
});

test('admin adds, edits and removes a product; storefront reflects it; payment settings save without leaking secrets', async ({ page, browser }) => {
  const name = `E2E Special ${Date.now()}`;
  await page.goto('/admin/login');
  await page.getByLabel('Email or mobile number').fill(OWNER.identifier);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('link', { name: 'Products' }).click();
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Price (₹)').fill('123');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText(name)).toBeVisible();

  const shop = await browser.newPage({ baseURL: 'http://localhost:5173' });
  await shop.goto(`/menu?q=${encodeURIComponent(name)}`);
  await expect(shop.getByRole('heading', { name })).toBeVisible();
  await expect(shop.getByText('₹123').first()).toBeVisible();

  await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Price (₹)').fill('150');
  await page.getByRole('button', { name: 'Save product' }).click();
  await shop.reload();
  await expect(shop.getByText('₹150').first()).toBeVisible();

  await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).last().click();
  await shop.reload();
  await expect(shop.getByText('No dishes found')).toBeVisible();
  await shop.close();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Payment gateway' })).toBeVisible();
  await page.getByLabel('Razorpay Key ID').fill('rzp_test_e2e12345');
  await page.getByLabel('Razorpay Key Secret').fill('e2e-secret-value');
  await page.getByRole('button', { name: 'Save payment settings' }).click();
  await expect(page.getByText('Keys saved')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('e2e-secret-value');
});
test('homepage hero changes items as the page scrolls, and admin can manage hero items', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveAccessibleName('Biscoff Tiramisu');
  await page.evaluate(() => window.scrollTo(0, 0.5 / 4 * 0.75 * 3 * 900 + 600));
  await expect(h1).toHaveAccessibleName('Classic Tiramisu', { timeout: 8000 });
  await page.getByRole('button', { name: 'Show Veg Chips Salad' }).click();
  await expect(h1).toHaveAccessibleName('Veg Chips Salad', { timeout: 8000 });

  await page.goto('/admin/login');
  await page.getByLabel('Email or mobile number').fill(OWNER.identifier);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Homepage hero' }).click();
  await expect(page.getByText('Chicken Salad Chips Bowl').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add item' })).toBeVisible();
});
test('rewards page shows points and a referral code; address search fills the form', async ({ page }) => {
  await page.goto('/login');
  await otpLogin(page, '95432' + String(Date.now()).slice(-5), 'Reward Tester');
  await page.goto('/account/rewards');
  await expect(page.getByText('Your ARAN.co points')).toBeVisible();
  await expect(page.getByText(/^[A-Z2-9]{6}$/)).toBeVisible();

  await page.route('**/api/v1/geo/search*', (r) => r.fulfill({ json: { success: true, data: [{ label: 'MG Road, Pune 411001', line1: 'MG Road', city: 'Pune', pincode: '411001', lat: 18.51, lng: 73.85 }] } }));
  await page.goto('/menu?q=classic');
  await page.getByRole('button', { name: 'Add Classic ARAN Burger to cart' }).click();
  await page.goto('/checkout');
  await page.getByLabel('Search address').fill('MG Road Pune');
  await page.getByRole('option', { name: /MG Road, Pune/ }).click();
  await expect(page.getByLabel('City')).toHaveValue('Pune');
  await expect(page.getByLabel('PIN code')).toHaveValue('411001');
  await expect(page.getByText('Location pinned')).toBeVisible();
});