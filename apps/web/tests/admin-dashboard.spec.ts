import { test, expect } from '@playwright/test';
import { mockAdminAuth, mockAdminDashboardStats } from './helpers/admin-auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({page}) => {
    // Mock auth endpoints to avoid rate limiting
    await mockAdminAuth(page);
    await mockAdminDashboardStats(page);
    
    // Navigate directly to admin page - auth is mocked, so we don't need login flow
    const base = process.env.WEB_BASE_URL || 'http://localhost:3001';
    await page.goto(`${base}/admin`);
  });

  test('should display admin dashboard with stats', async ({page}) => {
    // Already on /admin after beforeEach
    await expect(page.getByRole('heading', {name: 'Dashboard'})).toBeVisible();
    await expect(page.locator('text=Monitor your ticket sales performance')).toBeVisible();
    
    // Wait for stats to load (the mock returns data immediately)
    // The DashboardStats component shows loading skeletons first
    // Wait for the actual text to appear (not skeleton)
    await expect(page.locator('text=Total Revenue').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Order Count').first()).toBeVisible();
    await expect(page.locator('text=Average Order Value').first()).toBeVisible();
    await expect(page.locator('text=Tickets Sold').first()).toBeVisible();
  });
});
