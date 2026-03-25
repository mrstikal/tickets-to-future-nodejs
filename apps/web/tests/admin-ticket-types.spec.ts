import { test, expect } from '@playwright/test';
import { mockAdminAuth } from './helpers/admin-auth';

test.describe('Admin Ticket Types', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth endpoints to avoid rate limiting
    await mockAdminAuth(page);
    
    // perform login (same flow as other admin tests)
    const base = process.env.WEB_BASE_URL || 'http://localhost:3001';
    await page.goto(`${base}/login`);
    await page.fill('input[name="email"]', 'admin@tickets.local');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    // Wait for admin dashboard to appear instead of relying on navigation load event
    await page.waitForSelector('text=Dashboard');

    // Prepare default route handlers for ticket types API so tests are deterministic
    // Maintain an in-memory list of ticket types for the test session
    interface TicketType {
      id: string;
      title: string;
      description: string;
      isActive: boolean;
      imageAssetId: string;
      imageUrl?: string;
      totalQuantity: number;
      soldQuantity: number;
      createdAt: string;
      updatedAt: string;
    }
    const ticketTypes: TicketType[] = [];

    await page.route(/\/api\/v1\/admin\/ticket-types/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Helper to extract ID from URL path (supports /force suffix)
      function extractIdFromUrl(urlString: string): string | null {
        try {
          const urlObj = new URL(urlString);
          const match = urlObj.pathname.match(/^\/api\/v1\/admin\/ticket-types\/([^\/]+)/);
          return match ? match[1] : null;
        } catch {
          return null;
        }
      }

      if (method === 'GET') {
        // return paginated response
        const pageParam = new URL(url).searchParams.get('page') || '1';
        const limitParam = new URL(url).searchParams.get('limit') || '20';
        const pageNum = Number(pageParam);
        const limit = Number(limitParam);
        const start = (pageNum - 1) * limit;
        const items = ticketTypes.slice(start, start + limit);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items,
            meta: {
              total: ticketTypes.length,
              page: pageNum,
              limit,
              hasMore: start + limit < ticketTypes.length,
            },
          }),
        });
        return;
      }

      if (method === 'POST') {
        // create
        const postBody = await route.request().postDataJSON();
        // Generate ID in format "tt-xxxxxx" that matches frontend expectations
        const id = `tt-${Math.random().toString(36).slice(2, 10)}`;
        const created = {
          id,
          title: postBody.title,
          description: postBody.description || '',
          isActive: postBody.isActive ?? true,
          imageAssetId: postBody.imageAssetId || '',
          imageUrl: postBody.imageAssetId ? `http://localhost/_assets/${postBody.imageAssetId}` : undefined,
          totalQuantity: postBody.totalQuantity ?? 0,
          soldQuantity: postBody.soldQuantity ?? 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ticketTypes.unshift(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        return;
      }

      if (method === 'PUT') {
        // update
        try {
          const postBody = await route.request().postDataJSON();
          const id = extractIdFromUrl(url);
          const idx = ticketTypes.findIndex((t) => t.id === id);
          if (idx !== -1) {
            ticketTypes[idx] = { ...ticketTypes[idx], ...postBody, updatedAt: new Date().toISOString() };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ticketTypes[idx]) });
            return;
          }
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
          return;
        } catch {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Bad request' }) });
          return;
        }
      }

      if (method === 'DELETE') {
        const id = extractIdFromUrl(url);
        const idx = ticketTypes.findIndex((t) => t.id === id);
        if (idx !== -1) {
          ticketTypes.splice(idx, 1);
          await route.fulfill({ status: 204 });
          return;
        }
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
        return;
      }

      // fallback
      await route.continue();
    });

    // image upload endpoint (used by AvatarUpload)
    await page.route('**/api/v1/admin/image-assets/upload', async (route) => {
      // return a fake uploaded asset id (valid UUID) so client-side validation accepts it
      function genUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
      const id = genUuid();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, imageUrl: `http://localhost/_assets/${id}`, localImagePath: '' }),
      });
    });

    // check has-events endpoint
    await page.route('**/api/v1/admin/ticket-types/*/has-events', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasEvents: false }) });
    });

    // After login navigate to ticket types page
    await page.goto(`${base}/admin/ticket-types`);
  });

  test('UI shows headings, table and pagination controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ticket Types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Ticket Type' })).toBeVisible();

    // table headers
    await expect(page.locator('table thead')).toContainText('Avatar');
    await expect(page.locator('table thead')).toContainText('ID');
    await expect(page.locator('table thead')).toContainText('Title');
    await expect(page.locator('table thead')).toContainText('Is Active');
    await expect(page.locator('table thead')).toContainText('Edit');
    await expect(page.locator('table thead')).toContainText('Delete');

    // pagination controls exist (use text-based locators and pick first matches to avoid Next.js devtools button)
    await expect(page.locator('button:has-text("Previous")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Next")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Go to page")')).toBeVisible();
  });

  test('Modal behavior and form validation', async ({ page }) => {
    // Open create modal
    await page.getByRole('button', { name: 'Add Ticket Type' }).click();
    await expect(page.getByRole('heading', { name: 'Create Ticket Type' })).toBeVisible();

    // Work with the specific modal instance to avoid collisions with other UI buttons
    const modal = page.locator('div[role="dialog"]').filter({ hasText: 'Create Ticket Type' }).first();

    // Try submitting empty form -> Title required
    // Remove native required attribute so React validation runs and shows our custom message
    await modal.locator('#title').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.locator('text=Title is required')).toBeVisible();

    // Fill title only -> Avatar required
    await modal.locator('#title').fill('Playwright Test Type');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.locator('text=Avatar image is required')).toBeVisible();

    // Close with Cancel
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Create Ticket Type' })).not.toBeVisible();

    // Re-open and close with overlay click
    await page.getByRole('button', { name: 'Add Ticket Type' }).click();
    const overlay = page.locator('div[role="dialog"]').filter({ hasText: 'Create Ticket Type' }).first();
    // click on overlay (dialog background). Click near top-left where modal content isn't present
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('heading', { name: 'Create Ticket Type' })).not.toBeVisible();

    // Re-open and close with Escape
    await page.getByRole('button', { name: 'Add Ticket Type' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Create Ticket Type' })).not.toBeVisible();
  });

  test('Create -> Edit -> Delete flow (mocked backend)', async ({ page }) => {
    test.setTimeout(60000);
    // Open create modal
    await page.getByRole('button', { name: 'Add Ticket Type' }).click
    ();

    // Fill form
    await page.fill('#title', 'E2E Created Type');
    await page.fill('#description', 'Created by playwright test');
    // select an avatar file (we intercept upload, so content is irrelevant)
    const [uploadResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/image-assets/upload') && r.status() === 200),
      page.setInputFiles('#avatar-upload', [{ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]) }]),
    ]);
    // ensure upload completed
    await uploadResponse.finished();

    // Save - ensure POST is sent, then wait for the subsequent GET refresh that returns the created item
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-types') && r.request().method() === 'POST' && r.status() === 201),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);

    // Wait for the list GET that should include the created item
    const getResp = await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-types') && r.request().method() === 'GET' && r.status() === 200);
    const body = await getResp.json() as { items?: Array<{ title: string }> };
    if (!body.items || !body.items.find((it) => it.title === 'E2E Created Type')) {
      throw new Error('Created ticket type not present in GET response');
    }

    // After create the table should show the new item
    await page.waitForSelector(`text=E2E Created Type`);
    await expect(page.locator('table')).toContainText('E2E Created Type');

    // Click Edit on the created row
    const editButton = page.locator('table tbody tr').filter({ hasText: 'E2E Created Type' }).getByRole('button', { name: 'Edit' });
    await editButton.click();
    await expect(page.getByRole('heading', { name: 'Edit Ticket Type' })).toBeVisible();
    // Title prefilled
    await expect(page.locator('#title')).toHaveValue('E2E Created Type');

    // Change title and save
    await page.fill('#title', 'E2E Updated Type');
    
    await Promise.all([
      page.waitForResponse((r) => {
        return r.url().includes('/api/v1/admin/ticket-types/') && r.request().method() === 'PUT' && r.status() === 200;
      }, { timeout: 10000 }),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);
    // wait for list refresh GET
    await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-types') && r.request().method() === 'GET' && r.status() === 200);

    // Table should reflect update
    await expect(page.locator('table')).toContainText('E2E Updated Type');

    // Delete the item
    const deleteButton = page.locator('table tbody tr').filter({ hasText: 'E2E Updated Type' }).getByRole('button', { name: 'Delete' });
    await deleteButton.click();

    // Confirm delete modal
    await expect(page.getByRole('heading', { name: 'Warning' })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-types') && r.request().method() === 'DELETE' && (r.status() === 204 || r.status() === 200)),
      page.locator('div[role="dialog"]').getByRole('button', { name: 'Delete' }).click(),
    ]);
    // wait for list refresh
    await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-types') && r.request().method() === 'GET' && r.status() === 200);

    // Item should be removed from table
    await expect(page.locator('table')).not.toContainText('E2E Updated Type');
  });
});
