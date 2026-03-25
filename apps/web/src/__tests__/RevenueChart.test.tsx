import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RevenueChart from '../app/admin/components/RevenueChart';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 320 }}>{children}</div>
    ),
  };
});

describe('RevenueChart', () => {
  const data = [
    { date: '2026-01-01', revenue: 100 },
    { date: '2026-01-02', revenue: 200 },
  ];

  it('renders loading state', () => {
    render(<RevenueChart data={[]} isLoading={true} />);
    expect(screen.getByText(/Revenue over time/i)).toBeInTheDocument();
    // Check for presence of loading animation div instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders no data state', () => {
    render(<RevenueChart data={[]} isLoading={false} />);
    expect(screen.getByText(/No data to display/i)).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    render(<RevenueChart data={data} isLoading={false} />);
    expect(screen.getByText(/Revenue over time/i)).toBeInTheDocument();
  });
});
