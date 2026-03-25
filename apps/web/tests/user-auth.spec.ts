import { test, expect } from '@playwright/test';

test.describe('User Authentication & Discount Flows', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Start with a clean state - no authenticated user
    await page.route('**/api/v1/auth/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock tickets API for pages that need it
    await page.route('/api/v1/tickets', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'ticket-1',
              slug: 'test-ticket',
              title: 'Test Concert',
              description: 'A test concert',
              eventAt: '2025-12-31T20:00:00Z',
              price: 1000,
              currency: 'CZK',
              imageUrl: 'https://example.com/image.jpg',
              totalQuantity: 100,
              soldQuantity: 50,
              activeHolds: 5,
              availableQuantity: 45,
              isActive: true,
            },
          ],
          meta: { total: 1 },
        }),
      });
    });

    await page.route('/api/v1/tickets/ticket-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ticket-1',
          slug: 'test-ticket',
          title: 'Test Concert',
          description: 'A test concert',
          eventAt: '2025-12-31T20:00:00Z',
          price: 1000,
          currency: 'CZK',
          imageUrl: 'https://example.com/image.jpg',
          totalQuantity: 100,
          soldQuantity: 50,
          activeHolds: 5,
          availableQuantity: 45,
          isActive: true,
        }),
      });
    });

    // Mock holds API for cart/checkout tests
    await page.route(/\/api\/v1\/holds\/session\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'hold-1',
              ticketId: 'ticket-1',
              sessionId: 'test-session',
              status: 'active',
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              ttlSeconds: 900,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('/api/v1/holds/hold-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'hold-1',
          ticketId: 'ticket-1',
          sessionId: 'test-session',
          status: 'active',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          ttlSeconds: 900,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock events groups for homepage
    await page.route('/api/v1/events/groups', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          groups: [
            {
              periodStartYear: 2025,
              events: [
                {
                  id: 'ticket-1',
                  slug: 'test-ticket',
                  title: 'Test Concert',
                  description: 'A test concert',
                  eventAt: '2025-12-31T20:00:00Z',
                  price: 1000,
                  currency: 'CZK',
                  imageUrl: 'https://example.com/image.jpg',
                  totalQuantity: 100,
                  soldQuantity: 50,
                  activeHolds: 5,
                  availableQuantity: 45,
                  isActive: true,
                },
              ],
              totalCount: 1,
            },
          ],
        }),
      });
    });

    // Navigate to homepage
    await page.goto('/');
  });

  test('Sign Up flow with validation', async ({ page }) => {
    // Click Sign Up button in header
    await page.click('button:has-text("Sign Up")');

    // Verify Sign Up modal is open
    const modal = page.locator('div[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2:has-text("Sign Up")')).toBeVisible();

    // Verify form fields
    await expect(modal.locator('input[type="text"]')).toBeVisible(); // Name
    await expect(modal.locator('input[type="email"]')).toBeVisible();
    await expect(modal.locator('input[type="password"]')).toBeVisible();

    // Try submitting empty form (HTML5 validation)
    await modal.locator('button[type="submit"]').click();
    // Should still be visible (validation prevents submission)
    await expect(modal).toBeVisible();

    // Mock signup API endpoint
    await page.route('**/api/v1/auth/signup', async (route) => {
      const requestBody = await route.request().postDataJSON();
      
      // Validate request
      expect(requestBody.email).toBe('test@example.com');
      expect(requestBody.password).toBe('password123');
      expect(requestBody.name).toBe('Test User');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        headers: {
          'Set-Cookie': 'auth_token=mock-token; Path=/; HttpOnly; SameSite=Strict',
        },
      });
    });

    // Fill form with valid data
    await modal.locator('input[type="text"]').fill('Test User');
    await modal.locator('input[type="email"]').fill('test@example.com');
    await modal.locator('input[type="password"]').fill('password123');

    // Submit form
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/auth/signup')),
      modal.locator('button[type="submit"]').click(),
    ]);

    // Verify modal is closed
    await expect(modal).not.toBeVisible();

    // Verify user is shown in header with discount badge
    await expect(page.locator('text=Test User')).toBeVisible();
    await expect(page.locator('span:has-text("-10%")')).toBeVisible();

    // Verify Sign Up/Sign In buttons are gone
    await expect(page.locator('button:has-text("Sign Up")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).not.toBeVisible();
  });

  test('Sign In flow', async ({ page }) => {
    // First, mock that user is not authenticated (already done in beforeEach)
    // Click Sign In button in header
    await page.click('button:has-text("Sign In")');

    // Verify Sign In modal is open
    const modal = page.locator('div[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2:has-text("Sign In")')).toBeVisible();

    // Verify form fields (no Name field)
    await expect(modal.locator('input[type="text"]')).not.toBeVisible();
    await expect(modal.locator('input[type="email"]')).toBeVisible();
    await expect(modal.locator('input[type="password"]')).toBeVisible();

    // Mock login API endpoint
    await page.route('**/api/v1/auth/login', async (route) => {

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-456',
            email: 'existing@example.com',
            name: 'Existing User',
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        headers: {
          'Set-Cookie': 'auth_token=mock-token; Path=/; HttpOnly; SameSite=Strict',
        },
      });
    });

    // Fill form with valid data
    await modal.locator('input[type="email"]').fill('existing@example.com');
    await modal.locator('input[type="password"]').fill('password123');

    // Submit form
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/auth/login')),
      modal.locator('button[type="submit"]').click(),
    ]);

    // Verify modal is closed
    await expect(modal).not.toBeVisible();

    // Verify user is shown in header with discount badge
    await expect(page.locator('text=Existing User')).toBeVisible();
    await expect(page.locator('span:has-text("-10%")')).toBeVisible();
  });

  test('Discount display on tickets', async ({ page }) => {
    // Mock authenticated user for this test
    await page.route('**/api/v1/auth/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-789',
            email: 'discount@example.com',
            name: 'Discount User',
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Refresh to apply authenticated state, then open an existing ticket detail
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('a:has-text("View detail")').first().click();
    await page.waitForLoadState('networkidle');

    // Verify discount badge is visible
    await expect(page.locator('span:has-text("-10%")')).toBeVisible();

    // Verify original price is strikethrough and discounted price is highlighted
    const originalPrice = page.locator('span.line-through').first();
    const discountedPrice = page.locator('span.text-emerald-400').first();

    await expect(originalPrice).toBeVisible();
    await expect(discountedPrice).toBeVisible();

    const originalValue = Number.parseFloat((await originalPrice.textContent() ?? '').replace(/[^\d.]/g, ''));
    const discountedValue = Number.parseFloat((await discountedPrice.textContent() ?? '').replace(/[^\d.]/g, ''));

    expect(Number.isFinite(originalValue)).toBeTruthy();
    expect(Number.isFinite(discountedValue)).toBeTruthy();
    expect(discountedValue).toBeLessThan(originalValue);
    expect(discountedValue).toBeCloseTo(originalValue * 0.9, 1);
  });

  test('Discount application in cart and checkout', async ({ page }) => {
    // Mock authenticated user
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-999',
          email: 'cart@example.com',
          name: 'Cart User',
          role: 'user',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Ensure cart data endpoints are mocked for this test (self-contained)
    await page.route('**/api/v1/holds/session/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'hold-1',
              ticketId: 'ticket-1',
              sessionId: 'test-session',
              status: 'active',
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              ttlSeconds: 900,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/tickets/ticket-1**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ticket-1',
          slug: 'test-ticket',
          title: 'Test Concert',
          description: 'A test concert',
          eventAt: '2025-12-31T20:00:00Z',
          price: 1000,
          currency: 'CZK',
          imageUrl: 'http://localhost/image.jpg',
          totalQuantity: 100,
          soldQuantity: 50,
          activeHolds: 5,
          availableQuantity: 45,
          isActive: true,
        }),
      });
    });

    // Navigate to cart page
    await page.goto('/cart');

    // Wait for cart to load
    await page.waitForSelector('text=Cart');
    await expect(page.locator('text=Failed to load cart')).not.toBeVisible();

    // Verify discount is applied in cart item and cart total
    const cartDiscountBadges = page.locator('main span:has-text("-10%")');
    await expect(cartDiscountBadges).toHaveCount(2);
    await expect(cartDiscountBadges.nth(0)).toBeVisible();
    await expect(cartDiscountBadges.nth(1)).toBeVisible();

    const cartDiscountedPrices = page.locator('main p.text-emerald-400');
    await expect(page.locator('main span.line-through')).toHaveCount(2);
    await expect(cartDiscountedPrices).toHaveCount(2);
    await expect(page.locator('main span.line-through').nth(0)).toContainText(/1,?000 CZK/);
    await expect(page.locator('main span.line-through').nth(1)).toContainText(/1,?000 CZK/);
    await expect(cartDiscountedPrices.nth(0)).toContainText('900 CZK');
    await expect(cartDiscountedPrices.nth(1)).toContainText('900 CZK');

    // Verify "You save" message
    await expect(page.locator('text=You save 100 CZK')).toBeVisible();

    // Click Proceed to Checkout
    await page.click('a:has-text("Proceed to Checkout")');

    // Wait for checkout page
    await page.waitForURL('/checkout');

    // Verify discount on checkout page
    await expect(page.locator('main span:has-text("-10%")')).toBeVisible();
    await expect(
      page.locator('main span.line-through').filter({ hasText: /1,?000 CZK/ })
    ).toHaveCount(1);
    await expect(
      page.locator('main p.text-emerald-400').filter({ hasText: '900 CZK' })
    ).toHaveCount(1);

    // Verify email and name are pre-filled from authenticated user
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('cart@example.com');

    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toHaveValue('Cart User');
  });

  test('Order creation with discount', async ({ page }) => {
    const holdId = '11111111-1111-4111-8111-111111111111';

    // Mock authenticated user
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-888',
          email: 'order@example.com',
          name: 'Order User',
          role: 'user',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Ensure checkout data endpoints are mocked for this test
    await page.route(`**/api/v1/holds/${holdId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: holdId,
          ticketId: 'ticket-1',
          sessionId: 'test-session',
          status: 'active',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          ttlSeconds: 900,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/tickets/ticket-1**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ticket-1',
          slug: 'test-ticket',
          title: 'Test Concert',
          description: 'A test concert',
          eventAt: '2025-12-31T20:00:00Z',
          price: 1000,
          currency: 'CZK',
          imageUrl: 'http://localhost/image.jpg',
          totalQuantity: 100,
          soldQuantity: 50,
          activeHolds: 5,
          availableQuantity: 45,
          isActive: true,
        }),
      });
    });

    // Mock order creation API
    await page.route('**/api/v1/orders', async (route) => {
      const requestBody = await route.request().postDataJSON();
      
      // Validate request
      expect(requestBody.email).toBe('order@example.com');
      expect(requestBody.name).toBe('Order User');
      expect(requestBody.holdIds).toEqual([holdId]);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'order-123',
          orderNumber: 'ORD-123',
          status: 'created',
          email: 'order@example.com',
          name: 'Order User',
          referenceNumber: 'REF-123',
          currency: 'CZK',
          totalPrice: 1000,
          items: [
            {
              ticketId: 'ticket-1',
              ticketTitle: 'Test Concert',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/orders/order-123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'order-123',
          orderNumber: 'ORD-123',
          status: 'created',
          email: 'order@example.com',
          name: 'Order User',
          referenceNumber: 'REF-123',
          currency: 'CZK',
          totalPrice: 1000,
          items: [
            {
              ticketId: 'ticket-1',
              ticketTitle: 'Test Concert',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Navigate to checkout page directly (with hold)
    await page.goto(`/checkout?holdId=${holdId}`);

    // Wait for checkout page to load
    await page.waitForSelector('text=Checkout');

    // Verify discount is displayed
    await expect(page.locator('main span:has-text("-10%")')).toBeVisible();

    // Submit order
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/orders')),
      page.waitForURL('/orders/order-123'),
      page.click('button[type="submit"]:has-text("Confirm Order and Pay")'),
    ]);

    // Verify redirect to order detail route happened
    await expect(page).toHaveURL(/\/orders\/order-123$/);
  });
});
