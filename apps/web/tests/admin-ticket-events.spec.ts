import { test, expect } from '@playwright/test';
import { mockAdminAuth } from './helpers/admin-auth';

test.describe('Admin Ticket Events', () => {
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

    // Prepare default route handlers for ticket events API so tests are deterministic
    // Maintain an in-memory list of ticket events for the test session
    interface TicketEvent {
      id: string;
      ticketTypeId: string;
      slug: string;
      title: string;
      description: string;
      eventAt: string;
      price: number;
      currency: string;
      totalQuantity: number;
      soldQuantity: number;
      isActive: boolean;
      imageAssetId: string | null;
      imageUrl?: string;
      createdAt: string;
      updatedAt: string;
    }
    const ticketEvents: TicketEvent[] = [];

    // Mock ticket types for filter dropdown
    const ticketTypes = [
      { id: 'tt-1', title: 'Regular Ticket' },
      { id: 'tt-2', title: 'VIP Ticket' },
    ];

    await page.route(/\/api\/v1\/admin\/ticket-events/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Helper to extract ID from URL path (supports /force suffix)
      function extractIdFromUrl(urlString: string): string | null {
        try {
          const urlObj = new URL(urlString);
          const match = urlObj.pathname.match(/^\/api\/v1\/admin\/ticket-events\/([^\/]+)/);
          return match ? match[1] : null;
        } catch {
          return null;
        }
      }

      if (method === 'GET') {
        // return paginated response with optional ticketTypeId filter
        const pageParam = new URL(url).searchParams.get('page') || '1';
        const limitParam = new URL(url).searchParams.get('limit') || '20';
        const ticketTypeIdParam = new URL(url).searchParams.get('ticketTypeId');
        const pageNum = Number(pageParam);
        const limit = Number(limitParam);
        
        let filtered = ticketEvents;
        if (ticketTypeIdParam) {
          filtered = ticketEvents.filter(te => te.ticketTypeId === ticketTypeIdParam);
        }
        
        const start = (pageNum - 1) * limit;
        const items = filtered.slice(start, start + limit);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items,
            meta: {
              total: filtered.length,
              page: pageNum,
              limit,
              hasMore: start + limit < filtered.length,
            },
          }),
        });
        return;
      }

      if (method === 'POST') {
        // create
        const postBody = await route.request().postDataJSON();
        // Generate ID in format "te-xxxxxx" that matches frontend expectations
        const id = `te-${Math.random().toString(36).slice(2, 10)}`;
        const created = {
          id,
          ticketTypeId: postBody.ticketTypeId,
          slug: postBody.slug,
          title: postBody.title,
          description: postBody.description || '',
          eventAt: postBody.eventAt,
          price: postBody.price ?? 0,
          currency: postBody.currency || 'CZK',
          totalQuantity: postBody.totalQuantity ?? 0,
          soldQuantity: postBody.soldQuantity ?? 0,
          isActive: postBody.isActive ?? true,
          imageAssetId: postBody.imageAssetId || null,
          imageUrl: postBody.imageAssetId ? `http://localhost/_assets/${postBody.imageAssetId}` : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ticketEvents.unshift(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        return;
      }

      if (method === 'PUT') {
        // update
        try {
          const postBody = await route.request().postDataJSON();
          const id = extractIdFromUrl(url);
          const idx = ticketEvents.findIndex((t) => t.id === id);
          if (idx !== -1) {
            ticketEvents[idx] = { ...ticketEvents[idx], ...postBody, updatedAt: new Date().toISOString() };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ticketEvents[idx]) });
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
        const idx = ticketEvents.findIndex((t) => t.id === id);
        if (idx !== -1) {
          ticketEvents.splice(idx, 1);
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

    // check has-holds-or-orders endpoint
    await page.route('**/api/v1/admin/ticket-events/*/has-holds-or-orders', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasHoldsOrOrders: false }) });
    });

    // ticket types filter endpoint
    await page.route('**/api/v1/admin/filters/ticket-types', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: ticketTypes }),
      });
    });

    // After login navigate to ticket events page
    await page.goto(`${base}/admin/ticket-events`);
  });

  test('UI shows headings, table and pagination controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ticket Events' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Ticket Event' })).toBeVisible();

    // table headers
    await expect(page.locator('table thead')).toContainText('Avatar');
    await expect(page.locator('table thead')).toContainText('ID');
    await expect(page.locator('table thead')).toContainText('Slug');
    await expect(page.locator('table thead')).toContainText('Title');
    await expect(page.locator('table thead')).toContainText('Event Date');
    await expect(page.locator('table thead')).toContainText('Price');
    await expect(page.locator('table thead')).toContainText('Is Active');
    await expect(page.locator('table thead')).toContainText('Edit');
    await expect(page.locator('table thead')).toContainText('Delete');

    // pagination controls exist (use text-based locators and pick first matches to avoid Next.js devtools button)
    await expect(page.locator('button:has-text("Previous")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Next")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Go to page")')).toBeVisible();

    // filter label
    await expect(page.locator('label:has-text("Filter by Ticket Type:")')).toBeVisible();
  });

  test('Modal behavior and form validation', async ({ page }) => {
    // Open create modal
    await page.getByRole('button', { name: 'Add Ticket Event' }).click();
    await expect(page.getByRole('heading', { name: 'Create Ticket Event' })).toBeVisible();

    // Work with the specific modal instance to avoid collisions with other UI buttons
    const modal = page.locator('div[role="dialog"]').filter({ hasText: 'Create Ticket Event' }).first();

    // Try submitting empty form -> validation errors
    // Remove native required attributes so React validation runs and shows our custom messages
    await modal.locator('#ticketTypeId').evaluate((el: HTMLSelectElement) => el.removeAttribute('required'));
    await modal.locator('#slug').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await modal.locator('#title').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await modal.locator('#eventAt').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await modal.getByRole('button', { name: 'Save' }).click();
    // Wait for validation messages to appear
    await expect(modal.locator('text=Ticket type is required')).toBeVisible();
    // Note: The form shows only the first validation error (Ticket type is required)
    // The other fields are not validated until the first error is fixed
    // So we'll just check that at least one validation error appears

    // Fill only ticket type -> still missing fields
    await modal.locator('#ticketTypeId').selectOption('tt-1');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.locator('text=Slug is required')).toBeVisible();

    // Fill slug -> still missing title
    await modal.locator('#slug').fill('test-event');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.locator('text=Title is required')).toBeVisible();

    // Fill title -> still missing event date
    await modal.locator('#title').fill('Test Event');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.locator('text=Event date/time is required')).toBeVisible();

    // Close with Cancel
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Create Ticket Event' })).not.toBeVisible();

    // Re-open and close with overlay click
    await page.getByRole('button', { name: 'Add Ticket Event' }).click();
    const overlay = page.locator('div[role="dialog"]').filter({ hasText: 'Create Ticket Event' }).first();
    // click on overlay (dialog background). Click near top-left where modal content isn't present
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('heading', { name: 'Create Ticket Event' })).not.toBeVisible();

    // Re-open and close with Escape
    await page.getByRole('button', { name: 'Add Ticket Event' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Create Ticket Event' })).not.toBeVisible();
  });

  test('Create → Edit → Delete flow (mocked backend)', async ({ page }) => {
    test.setTimeout(60000);
    // Open create modal
    await page.getByRole('button', { name: 'Add Ticket Event' }).click();

    // Fill form
    await page.selectOption('#ticketTypeId', 'tt-1');
    await page.fill('#slug', 'e2e-test-event');
    await page.fill('#title', 'E2E Created Event');
    await page.fill('#description', 'Created by playwright test');
    // Set event date to tomorrow 14:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const eventAtValue = `${year}-${month}-${day}T14:00`;
    await page.fill('#eventAt', eventAtValue);
    await page.fill('#price', '500');
    await page.selectOption('#currency', 'CZK');
    await page.fill('#totalQuantity', '100');
    await page.fill('#soldQuantity', '0');
    await page.check('#isActive');
    
    // select an avatar file (we intercept upload, so content is irrelevant)
    const [uploadResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/image-assets/upload') && r.status() === 200),
      page.setInputFiles('#avatar-upload', [{ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]) }]),
    ]);
    // ensure upload completed
    await uploadResponse.finished();

    // Save - ensure POST is sent, then wait for the subsequent GET refresh that returns the created item
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-events') && r.request().method() === 'POST' && r.status() === 201),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);

    // Wait for the list GET that should include the created item
    const getResp = await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-events') && r.request().method() === 'GET' && r.status() === 200);
    const body = await getResp.json() as { items?: Array<{ title: string }> };
    if (!body.items || !body.items.find((it) => it.title === 'E2E Created Event')) {
      throw new Error('Created ticket event not present in GET response');
    }

    // After create the table should show the new item
    await page.waitForSelector(`text=E2E Created Event`);
    await expect(page.locator('table')).toContainText('E2E Created Event');

    // Click Edit on the created row
    const editButton = page.locator('table tbody tr').filter({ hasText: 'E2E Created Event' }).getByRole('button', { name: 'Edit' });
    await editButton.click();
    await expect(page.getByRole('heading', { name: 'Edit Ticket Event' })).toBeVisible();
    // Title prefilled
    await expect(page.locator('#title')).toHaveValue('E2E Created Event');

    // Change title and save
    await page.fill('#title', 'E2E Updated Event');
    
    await Promise.all([
      page.waitForResponse((r) => {
        return r.url().includes('/api/v1/admin/ticket-events/') && r.request().method() === 'PUT' && r.status() === 200;
      }, { timeout: 10000 }),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);
    // wait for list refresh GET
    await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-events') && r.request().method() === 'GET' && r.status() === 200);

    // Table should reflect update
    await expect(page.locator('table')).toContainText('E2E Updated Event');

    // Delete the item
    const deleteButton = page.locator('table tbody tr').filter({ hasText: 'E2E Updated Event' }).getByRole('button', { name: 'Delete' });
    await deleteButton.click();

    // Confirm delete modal
    await expect(page.getByRole('heading', { name: 'Warning' })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-events') && r.request().method() === 'DELETE' && (r.status() === 204 || r.status() === 200)),
      page.locator('div[role="dialog"]').getByRole('button', { name: 'Delete' }).click(),
    ]);
    // wait for list refresh
    await page.waitForResponse((r) => r.url().includes('/api/v1/admin/ticket-events') && r.request().method() === 'GET' && r.status() === 200);

    // Item should be removed from table
    await expect(page.locator('table')).not.toContainText('E2E Updated Event');
  });

  test('Filter by ticket type', async ({ page }) => {
    // We need to add events directly to the mocked backend before the test starts
    // Since we can't access the ticketEvents array from beforeEach, we'll create them
    // by making POST requests via the mocked API
    
    // Create first event with ticketTypeId = tt-1
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/admin/ticket-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTypeId: 'tt-1',
          slug: 'regular-event',
          title: 'Regular Ticket Event',
          description: 'Regular event',
          eventAt: new Date(Date.now() + 86400000).toISOString(),
          price: 300,
          currency: 'CZK',
          totalQuantity: 50,
          soldQuantity: 10,
          isActive: true,
          imageAssetId: null,
        }),
      });
      return response.json();
    });

    // Create second event with ticketTypeId = tt-2
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/admin/ticket-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTypeId: 'tt-2',
          slug: 'vip-event',
          title: 'VIP Ticket Event',
          description: 'VIP event',
          eventAt: new Date(Date.now() + 172800000).toISOString(),
          price: 1000,
          currency: 'CZK',
          totalQuantity: 20,
          soldQuantity: 5,
          isActive: true,
          imageAssetId: null,
        }),
      });
      return response.json();
    });

    // Reload the page to trigger GET with the new events
    await page.reload();
    
    // Wait for the table to show both events
    await expect(page.locator('table')).toContainText('Regular Ticket Event');
    await expect(page.locator('table')).toContainText('VIP Ticket Event');

    // Filter by ticket type tt-1 (Regular Ticket)
    // The filter is a react-select component, we need to click on the control and select option
    // From the snapshot, the combobox has ref=e34, but we can use a more reliable selector
    // Let's use the combobox role and filter by label
    const filterCombobox = page.getByRole('combobox', { name: /Filter by Ticket Type/i });
    await filterCombobox.click();
    // Wait for dropdown to appear
    await page.waitForSelector('[role="listbox"]');
    
    // Wait for GET request with ticketTypeId=tt-1 parameter
    const responsePromise = page.waitForResponse((r) => {
      const url = r.url();
      return url.includes('/api/v1/admin/ticket-events') && 
             r.request().method() === 'GET' &&
             url.includes('ticketTypeId=tt-1');
    });
    
    // Click the option
    await page.getByRole('option', { name: 'Regular Ticket' }).click();
    
    // Wait for response
    await responsePromise;
    
    // Verify only Regular Ticket Event is visible
    await expect(page.locator('table')).toContainText('Regular Ticket Event');
    await expect(page.locator('table')).not.toContainText('VIP Ticket Event');

    // Clear filter (select "All ticket types")
    await filterCombobox.click();
    // Click the clear indicator (X button) to clear selection - or select the placeholder
    await page.getByRole('option', { name: 'All ticket types' }).click();
    
    // Wait for GET request without ticketTypeId parameter
    await page.waitForResponse((r) => {
      const url = r.url();
      return url.includes('/api/v1/admin/ticket-events') && 
             r.request().method() === 'GET' &&
             !url.includes('ticketTypeId=');
    });

    // Both events should be visible again
    await expect(page.locator('table')).toContainText('Regular Ticket Event');
    await expect(page.locator('table')).toContainText('VIP Ticket Event');
  });
});
