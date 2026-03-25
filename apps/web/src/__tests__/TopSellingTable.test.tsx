import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopSellingTable from '../app/admin/components/TopSellingTable';

describe('TopSellingTable', () => {
  const items = [
    {
      ticketId: '1',
      title: 'Ticket 1',
      eventAt: '2026-01-01',
      sellThroughPercent: 50,
      soldQuantity: 50,
      totalQuantity: 100,
      revenue: 1000,
      imageUrl: '/image1.jpg',
    },
  ];

  it('renders loading state', () => {
    render(<TopSellingTable items={[]} isLoading={true} error={null} title="Top Selling" />);
    expect(screen.getByText('Top Selling')).toBeInTheDocument();
    // Check for presence of loading animation div instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<TopSellingTable items={[]} isLoading={false} error="Error" title="Top Selling" />);
    expect(screen.getByText(/error loading data/i)).toBeInTheDocument();
  });

  it('renders table with data', () => {
    render(<TopSellingTable items={items} isLoading={false} error={null} title="Top Selling" />);
    expect(screen.getByText('Ticket 1')).toBeInTheDocument();
    expect(screen.getByText('50/100')).toBeInTheDocument();
    // Use a function matcher to handle possible text node splits
    expect(screen.getByText((content) => {
      return content.includes('CZK') && content.includes('1,000');
    })).toBeInTheDocument();
  });
});
