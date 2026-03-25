import { Page } from '@playwright/test';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ADMIN_USER: AdminUser = {
  id: 'admin-1',
  email: 'admin@tickets.local',
  name: 'Admin User',
  role: 'admin',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Mocks authentication endpoints for admin E2E tests.
 * This prevents hitting the real API rate limit and ensures deterministic login.
 */
export async function mockAdminAuth(page: Page): Promise<void> {
  // Mock login endpoint
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': 'auth_token=mock-admin-token; Path=/; HttpOnly; SameSite=Strict',
      },
      body: JSON.stringify({ user: ADMIN_USER }),
    });
  });

  // Mock current user endpoint (used by auth context on page load)
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_USER),
    });
  });

  // Mock logout endpoint (optional, but good for completeness)
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Logged out successfully' }),
    });
  });
}

/**
 * Mocks admin dashboard stats endpoints.
 * Call this in tests that need dashboard data.
 */
export async function mockAdminDashboardStats(page: Page): Promise<void> {
  // Mock stats overview (including query parameters)
  await page.route('**/api/v1/admin/stats/overview*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalRevenue: 150000,
        orderCount: 42,
        avgOrderValue: 3571,
        ticketsSold: 120,
        revenueByDay: [
          { date: '2025-03-20', revenue: 5000 },
          { date: '2025-03-21', revenue: 7500 },
          { date: '2025-03-22', revenue: 12000 },
          { date: '2025-03-23', revenue: 8000 },
          { date: '2025-03-24', revenue: 9500 },
        ],
      }),
    });
  });

  // Mock top selling (including query parameters)
  await page.route('**/api/v1/admin/stats/top-selling*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            ticketId: 'ticket-1',
            title: 'Concert Ticket',
            imageUrl: '/assets/characters/rick.png',
            eventAt: '2025-12-31T20:00:00Z',
            soldQuantity: 85,
            totalQuantity: 100,
            revenue: 85000,
            sellThroughPercent: 85,
          },
          {
            ticketId: 'ticket-2',
            title: 'VIP Pass',
            imageUrl: '/assets/characters/morty.png',
            eventAt: '2025-12-31T20:00:00Z',
            soldQuantity: 45,
            totalQuantity: 50,
            revenue: 45000,
            sellThroughPercent: 90,
          },
        ],
      }),
    });
  });

  // Mock least selling (including query parameters)
  await page.route('**/api/v1/admin/stats/least-selling*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            ticketId: 'ticket-3',
            title: 'Festival Pass',
            imageUrl: '/assets/characters/summer.png',
            eventAt: '2025-12-31T20:00:00Z',
            soldQuantity: 5,
            totalQuantity: 100,
            revenue: 5000,
            sellThroughPercent: 5,
          },
          {
            ticketId: 'ticket-4',
            title: 'Single Ticket',
            imageUrl: '/assets/characters/beth.png',
            eventAt: '2025-12-31T20:00:00Z',
            soldQuantity: 10,
            totalQuantity: 100,
            revenue: 10000,
            sellThroughPercent: 10,
          },
        ],
      }),
    });
  });

  // Mock ticket types filter endpoint (used by DashboardFilters)
  await page.route('**/api/v1/admin/filters/ticket-types*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
      }),
    });
  });

  // Mock ticket events filter endpoint (used by DashboardFilters)
  await page.route('**/api/v1/admin/filters/ticket-events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
      }),
    });
  });
}