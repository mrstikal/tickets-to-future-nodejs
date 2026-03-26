import { test, expect } from '@playwright/test';
import { mockAdminAuth } from './helpers/admin-auth';

test.describe('Admin Orders', () => {
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

    // Prepare default route handlers for orders API so tests are deterministic
    // Maintain an in-memory list of orders for the test session
    interface OrderItem {
      ticketId: string;
      ticketTitle: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }

    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: OrderItem[];
    }

    const orders: Order[] = [];
    const orderDetails: Map<string, OrderDetail> = new Map();

    // Helper to extract ID from URL path
    function extractIdFromUrl(urlString: string): string | null {
      try {
        const urlObj = new URL(urlString);
        const match = urlObj.pathname.match(/^\/api\/v1\/admin\/orders\/([^\/]+)/);
        return match ? match[1] : null;
      } catch {
        return null;
      }
    }

    await page.route(/\/api\/v1\/admin\/orders/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET detail endpoint (must be checked before list endpoint)
      const id = extractIdFromUrl(url);
      if (method === 'GET' && id) {
        const detail = orderDetails.get(id);
        if (detail) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(detail),
          });
          return;
        }
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
        return;
      }

      if (method === 'GET') {
        // return paginated response with optional filters
        const pageParam = new URL(url).searchParams.get('page') || '1';
        const limitParam = new URL(url).searchParams.get('limit') || '20';
        const statusParam = new URL(url).searchParams.get('status');
        const startDateParam = new URL(url).searchParams.get('startDate');
        const endDateParam = new URL(url).searchParams.get('endDate');
        const emailParam = new URL(url).searchParams.get('email');
        const pageNum = Number(pageParam);
        const limit = Number(limitParam);

        let filtered = orders;

        // Apply filters
        if (statusParam) {
          filtered = filtered.filter((o) => o.status === statusParam);
        }
        if (startDateParam) {
          const startDate = new Date(startDateParam);
          filtered = filtered.filter((o) => new Date(o.createdAt) >= startDate);
        }
        if (endDateParam) {
          const endDate = new Date(endDateParam);
          endDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter((o) => new Date(o.createdAt) <= endDate);
        }
        if (emailParam) {
          filtered = filtered.filter((o) => o.email.includes(emailParam));
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

      // POST cancel endpoint
      if (method === 'POST' && url.includes('/cancel')) {
        const id = extractIdFromUrl(url);
        if (id) {
          const detail = orderDetails.get(id);
          if (detail) {
            detail.status = 'cancelled';
            const orderIdx = orders.findIndex((o) => o.id === id);
            if (orderIdx !== -1) {
              orders[orderIdx].status = 'cancelled';
            }
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(detail),
            });
            return;
          }
        }
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
        return;
      }

      // PATCH total-price endpoint
      if (method === 'PATCH' && url.includes('/total-price')) {
        const id = extractIdFromUrl(url);
        if (id) {
          const body = await route.request().postDataJSON();
          const detail = orderDetails.get(id);
          if (detail) {
            detail.totalPrice = body.totalPrice;
            const orderIdx = orders.findIndex((o) => o.id === id);
            if (orderIdx !== -1) {
              orders[orderIdx].totalPrice = body.totalPrice;
            }
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(detail),
            });
            return;
          }
        }
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
        return;
      }

      // fallback
      await route.continue();
    });

    // After login navigate to orders page
    await page.goto(`${base}/admin/orders`);

    // Expose helper function to add orders for tests
    await page.addInitScript(
      ({ orders: ordersData, orderDetails: detailsData }) => {
        ((window as unknown) as { __testOrders: unknown; __testOrderDetails: unknown }).__testOrders = ordersData;
        ((window as unknown) as { __testOrders: unknown; __testOrderDetails: unknown }).__testOrderDetails = detailsData;
      },
      { orders, orderDetails: Array.from(orderDetails.entries()) }
    );

    // Store references for test access
    (page as unknown as { __testOrders: Order[]; __testOrderDetails: Map<string, OrderDetail> }).__testOrders = orders;
    (page as unknown as { __testOrders: Order[]; __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails = orderDetails;
  });

  test('UI shows headings, table headers, pagination controls, and filter bar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

    // table headers
    await expect(page.locator('table thead')).toContainText('ID');
    await expect(page.locator('table thead')).toContainText('Order Number');
    await expect(page.locator('table thead')).toContainText('Status');
    await expect(page.locator('table thead')).toContainText('Email');
    await expect(page.locator('table thead')).toContainText('Name');
    await expect(page.locator('table thead')).toContainText('Total Price');
    await expect(page.locator('table thead')).toContainText('Currency');
    await expect(page.locator('table thead')).toContainText('Created At');
    await expect(page.locator('table thead')).toContainText('Detail');

    // pagination controls exist
    await expect(page.locator('button:has-text("Previous")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Next")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Go to page")')).toBeVisible();

    // filter bar
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
    await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
    await expect(page.locator('label:has-text("End Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Email Search")')).toBeVisible();
  });

  test('Empty state (no orders)', async ({ page }) => {
    await expect(page.locator('table tbody')).toContainText('No orders found.');
  });

  test('List with mocked orders (status badges, date formatting, price formatting)', async ({ page }) => {
    // Add orders via page context
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order1: Order = {
      id: 'ord-1',
      orderNumber: 'ORD-001',
      status: 'confirmed',
      email: 'customer1@example.com',
      name: 'John Doe',
      referenceNumber: 'REF-001',
      totalPrice: 1500.50,
      currency: 'CZK',
      itemCount: 2,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const detail1: OrderDetail = {
      ...order1,
      items: [
        { ticketId: 'tk-1', ticketTitle: 'Concert Ticket', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
        { ticketId: 'tk-2', ticketTitle: 'VIP Pass', quantity: 1, unitPrice: 500.50, totalPrice: 500.50 },
      ],
    };
    orders.push(order1);
    orderDetails.set('ord-1', detail1);

    const order2: Order = {
      id: 'ord-2',
      orderNumber: 'ORD-002',
      status: 'created',
      email: 'customer2@example.com',
      name: 'Jane Smith',
      referenceNumber: 'REF-002',
      totalPrice: 2000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000).toISOString(),
    };
    const detail2: OrderDetail = {
      ...order2,
      items: [{ ticketId: 'tk-3', ticketTitle: 'Festival Pass', quantity: 2, unitPrice: 1000, totalPrice: 2000 }],
    };
    orders.push(order2);
    orderDetails.set('ord-2', detail2);

    const order3: Order = {
      id: 'ord-3',
      orderNumber: 'ORD-003',
      status: 'cancelled',
      email: 'customer3@example.com',
      name: 'Bob Wilson',
      referenceNumber: 'REF-003',
      totalPrice: 500,
      currency: 'CZK',
      itemCount: 1,
      createdAt: new Date(now.getTime() - 172800000).toISOString(),
      updatedAt: new Date(now.getTime() - 172800000).toISOString(),
    };
    const detail3: OrderDetail = {
      ...order3,
      items: [{ ticketId: 'tk-4', ticketTitle: 'Single Ticket', quantity: 1, unitPrice: 500, totalPrice: 500 }],
    };
    orders.push(order3);
    orderDetails.set('ord-3', detail3);

    // Reload to fetch the orders
    await page.reload();

    // Verify orders are displayed
    await expect(page.locator('table')).toContainText('ORD-001');
    await expect(page.locator('table')).toContainText('ORD-002');
    await expect(page.locator('table')).toContainText('ORD-003');

    // Verify status badges with correct colors
    const row1 = page.locator('table tbody tr').filter({ hasText: 'ORD-001' });
    await expect(row1.locator('span.bg-green-600')).toContainText('confirmed');

    const row2 = page.locator('table tbody tr').filter({ hasText: 'ORD-002' });
    await expect(row2.locator('span.bg-yellow-600')).toContainText('created');

    const row3 = page.locator('table tbody tr').filter({ hasText: 'ORD-003' });
    await expect(row3.locator('span.bg-orange-600')).toContainText('cancelled');

    // Verify price formatting (should display as-is)
    await expect(page.locator('table')).toContainText('1500.5');
    await expect(page.locator('table')).toContainText('2000');
    await expect(page.locator('table')).toContainText('500');
  });

  test('Filter by status', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order1: Order = {
      id: 'ord-f1',
      orderNumber: 'ORD-F01',
      status: 'confirmed',
      email: 'test1@example.com',
      name: 'Test User 1',
      referenceNumber: 'REF-F01',
      totalPrice: 1000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order1);
    orderDetails.set('ord-f1', { ...order1, items: [] });

    const order2: Order = {
      id: 'ord-f2',
      orderNumber: 'ORD-F02',
      status: 'created',
      email: 'test2@example.com',
      name: 'Test User 2',
      referenceNumber: 'REF-F02',
      totalPrice: 2000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order2);
    orderDetails.set('ord-f2', { ...order2, items: [] });

    await page.reload();

    // Verify both orders are visible
    await expect(page.locator('table')).toContainText('ORD-F01');
    await expect(page.locator('table')).toContainText('ORD-F02');

    // Filter by status "Confirmed"
    const statusCombobox = page.getByRole('combobox', { name: /Status/i });
    
    // Register response listener BEFORE opening dropdown
    const confirmedResponsePromise = page.waitForResponse((r) => {
      const url = r.url();
      return (
        url.includes('/api/v1/admin/orders') &&
        r.request().method() === 'GET' &&
        url.includes('status=confirmed')
      );
    });
    
    await statusCombobox.click();
    await page.waitForSelector('[role="listbox"]');
    await page.getByRole('option', { name: 'Confirmed' }).click();
    
    // Wait for the response
    await confirmedResponsePromise;

    // Verify only confirmed order is visible
    await expect(page.locator('table')).toContainText('ORD-F01');
    await expect(page.locator('table')).not.toContainText('ORD-F02');

    // Clear filter
    // Register response listener BEFORE opening dropdown
    const clearResponsePromise = page.waitForResponse((r) => {
      const url = r.url();
      return (
        url.includes('/api/v1/admin/orders') &&
        r.request().method() === 'GET' &&
        !url.includes('status=')
      );
    });
    
    await statusCombobox.click();
    await page.waitForSelector('[role="listbox"]');
    await page.getByRole('option', { name: 'All statuses' }).click();
    
    // Wait for the response
    await clearResponsePromise;

    // Both orders should be visible again
    await expect(page.locator('table')).toContainText('ORD-F01');
    await expect(page.locator('table')).toContainText('ORD-F02');
  });

  test('Filter by date range', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);

    const order1: Order = {
      id: 'ord-d1',
      orderNumber: 'ORD-D01',
      status: 'created',
      email: 'date1@example.com',
      name: 'Date Test 1',
      referenceNumber: 'REF-D01',
      totalPrice: 1000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
    };
    orders.push(order1);
    orderDetails.set('ord-d1', { ...order1, items: [] });

    const order2: Order = {
      id: 'ord-d2',
      orderNumber: 'ORD-D02',
      status: 'created',
      email: 'date2@example.com',
      name: 'Date Test 2',
      referenceNumber: 'REF-D02',
      totalPrice: 2000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    };
    orders.push(order2);
    orderDetails.set('ord-d2', { ...order2, items: [] });

    await page.reload();

    // Set start date to today
    const todayStr = today.toISOString().split('T')[0];
    
    // Wait for GET with startDate BEFORE filling
    await Promise.all([
      page.waitForResponse((r) => {
        const url = r.url();
        return (
          url.includes('/api/v1/admin/orders') &&
          r.request().method() === 'GET' &&
          url.includes(`startDate=${todayStr}`)
        );
      }),
      page.fill('#start-date', todayStr),
    ]);

    // Only today's order should be visible
    await expect(page.locator('table')).not.toContainText('ORD-D01');
    await expect(page.locator('table')).toContainText('ORD-D02');

    // Clear start date
    await page.fill('#start-date', '');

    // Wait for GET without startDate
    await page.waitForResponse((r) => {
      const url = r.url();
      return (
        url.includes('/api/v1/admin/orders') &&
        r.request().method() === 'GET' &&
        !url.includes('startDate=')
      );
    });

    // Both should be visible again
    await expect(page.locator('table')).toContainText('ORD-D01');
    await expect(page.locator('table')).toContainText('ORD-D02');
  });

  test('Filter by email', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order1: Order = {
      id: 'ord-e1',
      orderNumber: 'ORD-E01',
      status: 'created',
      email: 'alice@example.com',
      name: 'Alice',
      referenceNumber: 'REF-E01',
      totalPrice: 1000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order1);
    orderDetails.set('ord-e1', { ...order1, items: [] });

    const order2: Order = {
      id: 'ord-e2',
      orderNumber: 'ORD-E02',
      status: 'created',
      email: 'bob@example.com',
      name: 'Bob',
      referenceNumber: 'REF-E02',
      totalPrice: 2000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order2);
    orderDetails.set('ord-e2', { ...order2, items: [] });

    await page.reload();

    // Filter by email "alice"
    await Promise.all([
      page.waitForResponse((r) => {
        const url = r.url();
        return (
          url.includes('/api/v1/admin/orders') &&
          r.request().method() === 'GET' &&
          url.includes('email=alice')
        );
      }),
      page.fill('#email-filter', 'alice'),
    ]);

    // Only alice's order should be visible
    await expect(page.locator('table')).toContainText('ORD-E01');
    await expect(page.locator('table')).not.toContainText('ORD-E02');

    // Clear email filter
    await page.fill('#email-filter', '');

    // Wait for GET without email filter
    await page.waitForResponse((r) => {
      const url = r.url();
      return (
        url.includes('/api/v1/admin/orders') &&
        r.request().method() === 'GET' &&
        !url.includes('email=')
      );
    });

    // Both should be visible again
    await expect(page.locator('table')).toContainText('ORD-E01');
    await expect(page.locator('table')).toContainText('ORD-E02');
  });

  test('Open detail modal → verify order info and items → close modal', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order: Order = {
      id: 'ord-detail',
      orderNumber: 'ORD-DETAIL',
      status: 'confirmed',
      email: 'detail@example.com',
      name: 'Detail Test',
      referenceNumber: 'REF-DETAIL',
      totalPrice: 1500,
      currency: 'CZK',
      itemCount: 2,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order);
    orderDetails.set('ord-detail', {
      ...order,
      items: [
        { ticketId: 'tk-1', ticketTitle: 'Concert Ticket', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
        { ticketId: 'tk-2', ticketTitle: 'VIP Pass', quantity: 1, unitPrice: 500, totalPrice: 500 },
      ],
    });

    await page.reload();

    // Click Detail button
    const detailButton = page.locator('table tbody tr').filter({ hasText: 'ORD-DETAIL' }).getByRole('button', { name: 'Detail' });
    await detailButton.click();

    const modal = page.locator('div[role="dialog"]').first();

    // Verify modal is open with order info
    await expect(page.getByRole('heading', { name: 'Order Detail' })).toBeVisible();
    await expect(modal.locator('text=ORD-DETAIL')).toBeVisible();
    await expect(modal.locator('text=detail@example.com')).toBeVisible();
    await expect(modal.locator('text=Detail Test')).toBeVisible();
    await expect(modal.locator('text=REF-DETAIL')).toBeVisible();

    // Verify items table
    await expect(modal.locator('text=Concert Ticket')).toBeVisible();
    await expect(modal.locator('text=VIP Pass')).toBeVisible();
    await expect(modal.locator('td:has-text("1000 CZK")').first()).toBeVisible();
    await expect(modal.locator('td:has-text("500 CZK")').first()).toBeVisible();

    // Close modal with Close button
    await modal.getByRole('button', { name: 'Close', exact: true }).click();

    // Verify modal is closed
    await expect(page.getByRole('heading', { name: 'Order Detail' })).not.toBeVisible();
  });

  test('Cancel order flow (confirm dialog → status changes to cancelled → Cancel button disappears)', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order: Order = {
      id: 'ord-cancel',
      orderNumber: 'ORD-CANCEL',
      status: 'confirmed',
      email: 'cancel@example.com',
      name: 'Cancel Test',
      referenceNumber: 'REF-CANCEL',
      totalPrice: 1000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order);
    orderDetails.set('ord-cancel', {
      ...order,
      items: [{ ticketId: 'tk-1', ticketTitle: 'Test Ticket', quantity: 1, unitPrice: 1000, totalPrice: 1000 }],
    });

    await page.reload();

    // Open detail modal
    const detailButton = page.locator('table tbody tr').filter({ hasText: 'ORD-CANCEL' }).getByRole('button', { name: 'Detail' });
    await detailButton.click();

    // Verify Cancel Order button is visible
    const modal = page.locator('div[role="dialog"]').first();
    await expect(modal.getByRole('button', { name: 'Cancel Order' })).toBeVisible();

    // Click Cancel Order button
    await modal.getByRole('button', { name: 'Cancel Order' }).click();

    // Verify confirm dialog appears
    await expect(modal.locator('text=Are you sure you want to cancel this order?')).toBeVisible();

    // Click Yes, Cancel
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/orders/') && r.url().includes('/cancel') && r.status() === 200),
      modal.getByRole('button', { name: 'Yes, Cancel' }).click(),
    ]);

    // Verify status changed to cancelled
    await expect(modal.locator('span.bg-orange-600')).toContainText('cancelled');

    // Verify Cancel Order button is gone
    await expect(modal.getByRole('button', { name: 'Cancel Order' })).not.toBeVisible();

    // Close modal and verify table also shows cancelled status
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    const row = page.locator('table tbody tr').filter({ hasText: 'ORD-CANCEL' });
    await expect(row.locator('span.bg-orange-600')).toContainText('cancelled');
  });

  test('Update total price flow (edit field → save → price updates in modal and table)', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    const order: Order = {
      id: 'ord-price',
      orderNumber: 'ORD-PRICE',
      status: 'created',
      email: 'price@example.com',
      name: 'Price Test',
      referenceNumber: 'REF-PRICE',
      totalPrice: 1000,
      currency: 'CZK',
      itemCount: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    orders.push(order);
    orderDetails.set('ord-price', {
      ...order,
      items: [{ ticketId: 'tk-1', ticketTitle: 'Test Ticket', quantity: 1, unitPrice: 1000, totalPrice: 1000 }],
    });

    await page.reload();

    // Verify initial price in table
    const row = page.locator('table tbody tr').filter({ hasText: 'ORD-PRICE' });
    await expect(row).toContainText('1000');

    // Open detail modal
    const detailButton = row.getByRole('button', { name: 'Detail' });
    await detailButton.click();

    const modal = page.locator('div[role="dialog"]').first();

    // Verify initial price in modal
    const priceInput = modal.locator('input[type="number"]');
    await expect(priceInput).toHaveValue('1000');

    // Change price
    await priceInput.fill('1500');

    // Click Save
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/orders/') && r.url().includes('/total-price') && r.status() === 200),
      modal.getByRole('button', { name: 'Save' }).click(),
    ]);

    // Verify price updated in modal
    await expect(priceInput).toHaveValue('1500');

    // Close modal
    await modal.getByRole('button', { name: 'Close', exact: true }).click();

    // Verify price updated in table
    const updatedRow = page.locator('table tbody tr').filter({ hasText: 'ORD-PRICE' });
    await expect(updatedRow).toContainText('1500');
  });

  test('Pagination (next/previous page, go to page)', async ({ page }) => {
    interface Order {
      id: string;
      orderNumber: string;
      status: 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
      email: string;
      name: string;
      referenceNumber: string;
      totalPrice: number;
      currency: string;
      itemCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrderDetail extends Order {
      items: Array<{
        ticketId: string;
        ticketTitle: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }

    const orders = (page as unknown as { __testOrders: Order[] }).__testOrders;
    const orderDetails = (page as unknown as { __testOrderDetails: Map<string, OrderDetail> }).__testOrderDetails;

    const now = new Date();
    // Create 25 orders to span multiple pages (20 per page)
    for (let i = 1; i <= 25; i++) {
      const order: Order = {
        id: `ord-page-${i}`,
        orderNumber: `ORD-PAGE-${String(i).padStart(3, '0')}`,
        status: 'created',
        email: `page${i}@example.com`,
        name: `Page Test ${i}`,
        referenceNumber: `REF-PAGE-${i}`,
        totalPrice: 1000 + i * 100,
        currency: 'CZK',
        itemCount: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      orders.push(order);
      orderDetails.set(`ord-page-${i}`, {
        ...order,
        items: [{ ticketId: `tk-${i}`, ticketTitle: `Ticket ${i}`, quantity: 1, unitPrice: 1000 + i * 100, totalPrice: 1000 + i * 100 }],
      });
    }

    await page.reload();

    // Verify page 1 is displayed
    await expect(page.locator('span.bg-green-600:has-text("1")')).toBeVisible();
    await expect(page.locator('table')).toContainText('ORD-PAGE-001');
    await expect(page.locator('table')).not.toContainText('ORD-PAGE-021');

    // Verify Previous is disabled on page 1
    await expect(page.locator('button:has-text("Previous")').first()).toBeDisabled();

    // Click Next
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/orders') && r.url().includes('page=2')),
      page.locator('button:has-text("Next")').first().click(),
    ]);

    // Verify page 2 is displayed
    await expect(page.locator('span.bg-green-600:has-text("2")')).toBeVisible();
    await expect(page.locator('table')).toContainText('ORD-PAGE-021');

    // Click Previous
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/orders') && r.url().includes('page=1')),
      page.locator('button:has-text("Previous")').first().click(),
    ]);

    // Verify page 1 is displayed again
    await expect(page.locator('span.bg-green-600:has-text("1")')).toBeVisible();
    await expect(page.locator('table')).toContainText('ORD-PAGE-001');

    // Use Go to page input
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/admin/orders') && r.url().includes('page=2')),
      page.fill('#gotoPage', '2'),
    ]);

    // Verify page 2 is displayed
    await expect(page.locator('span.bg-green-600:has-text("2")')).toBeVisible();
  });
});
