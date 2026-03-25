import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardStats from '../app/admin/components/DashboardStats';
import type { AdminStatsOverview } from '@/types/admin';

describe('DashboardStats', () => {
  const stats: AdminStatsOverview = {
    totalRevenue: 1000,
    orderCount: 50,
    avgOrderValue: 20,
    ticketsSold: 200,
    revenueByDay: [],
  };

  it('renders loading state', () => {
    render(<DashboardStats stats={null} isLoading={true} error={null} />);
    // Check for presence of loading animation div instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<DashboardStats stats={null} isLoading={false} error="Failed to load" />);
    expect(screen.getByText(/error loading statistics/i)).toBeInTheDocument();
  });

  it('renders stats correctly', () => {
    render(<DashboardStats stats={stats} isLoading={false} error={null} />);
    // Use a function matcher to handle possible text node splits
    expect(screen.getByText((content) => {
      return content.includes('CZK') && content.includes('1,000.00');
    })).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText((content) => {
      return content.includes('CZK') && content.includes('20.00');
    })).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
