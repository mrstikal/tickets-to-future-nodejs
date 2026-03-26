import React from 'react';
import { render, screen } from '@testing-library/react';
import HomeTicketGroups from '@/components/HomeTicketGroups';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  },
}));

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/features/auth-context', async () => {
  const actual = await vi.importActual('@/features/auth-context');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

const mockGroups = [
  {
    periodStartYear: 2025,
    events: [
      {
        id: 'ticket-1',
        title: 'Rick and Morty Live',
        description: 'An interdimensional adventure',
        eventAt: '2025-06-15T19:00:00Z',
        price: 100,
        currency: 'USD',
        imageUrl: '/images/rick-morty.jpg',
        availableQuantity: 50,
        soldQuantity: 10,
        activeHolds: 5,
        totalQuantity: 100,
        isActive: true,
        slug: 'rick-and-morty-live',
      },
      {
        id: 'ticket-2',
        title: 'Sold Out Concert',
        description: 'No tickets left',
        eventAt: null,
        price: 75,
        currency: 'USD',
        imageUrl: '/images/concert.jpg',
        availableQuantity: 0,
        soldQuantity: 100,
        activeHolds: 0,
        totalQuantity: 100,
        isActive: true,
        slug: 'sold-out-concert',
      },
    ],
    totalCount: 7,
  },
  {
    periodStartYear: 2030,
    events: [
      {
        id: 'ticket-3',
        title: 'Future Tech Expo',
        description: 'Technology of tomorrow',
        eventAt: '2030-10-20T10:00:00Z',
        price: 200,
        currency: 'USD',
        imageUrl: '/images/tech.jpg',
        availableQuantity: 10,
        soldQuantity: 90,
        activeHolds: 2,
        totalQuantity: 100,
        isActive: true,
        slug: 'future-tech-expo',
      },
    ],
    totalCount: 1,
  },
];

describe('HomeTicketGroups', () => {
  function renderComponent(discount = 0) {
    mockUseAuth.mockReturnValue({
      user: discount > 0 ? { id: '1', email: 'user@example.com', name: 'User', role: 'user' } : null,
      isAuthenticated: discount > 0,
      discount,
      logout: vi.fn(),
    });

    return render(
      <AuthProvider>
        <HomeTicketGroups groups={mockGroups} />
      </AuthProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders group headers', () => {
    renderComponent();
    expect(screen.getByText('Events 2025–2029')).toBeInTheDocument();
    expect(screen.getByText('Events 2030–2034')).toBeInTheDocument();
  });

  test('renders ticket cards with correct titles', () => {
    renderComponent();
    expect(screen.getByText('Rick and Morty Live')).toBeInTheDocument();
    expect(screen.getByText('Sold Out Concert')).toBeInTheDocument();
    expect(screen.getByText('Future Tech Expo')).toBeInTheDocument();
  });

  test('shows regular price when discount = 0', () => {
    renderComponent(0);
    // Regular price displayed
    expect(screen.getByText('100 USD')).toBeInTheDocument();
    expect(screen.getByText('75 USD')).toBeInTheDocument();
    expect(screen.getByText('200 USD')).toBeInTheDocument();
    // No discount badge
    expect(screen.queryByText('-10%')).not.toBeInTheDocument();
    // No strikethrough price
    expect(screen.queryByText('100 USD', { selector: '.line-through' })).not.toBeInTheDocument();
  });

  test('shows discount badge and discounted price when discount = 10', () => {
    renderComponent(10);
    // Discount badge present
    expect(screen.getAllByText('-10%')).toHaveLength(3);
    // Strikethrough original price
    expect(screen.getAllByText('100 USD', { selector: '.line-through' })).toHaveLength(1);
    expect(screen.getAllByText('75 USD', { selector: '.line-through' })).toHaveLength(1);
    expect(screen.getAllByText('200 USD', { selector: '.line-through' })).toHaveLength(1);
    // Discounted price (green)
    expect(screen.getByText('90 USD')).toBeInTheDocument();
    expect(screen.getByText('67.5 USD')).toBeInTheDocument();
    expect(screen.getByText('180 USD')).toBeInTheDocument();
  });

  test('shows "available" when quantity > 0', () => {
    renderComponent();
    expect(screen.getByText('50 available')).toBeInTheDocument();
    expect(screen.getByText('10 available')).toBeInTheDocument();
  });

  test('shows "Sold out" when quantity = 0', () => {
    renderComponent();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });

  test('shows "Show more" link when totalCount > 5', () => {
    renderComponent();
    // First group has totalCount = 7, so show more link appears
    expect(screen.getByText('Show more (2 more)')).toBeInTheDocument();
    expect(screen.getByText('Show more (2 more)').closest('a')).toHaveAttribute(
      'href',
      '/events/2025-2029'
    );
  });

  test('does not show "Show more" link when totalCount <= 5', () => {
    renderComponent();
    // Second group has totalCount = 1, no show more link
    expect(screen.queryByText('Show more (0 more)')).not.toBeInTheDocument();
  });

  test('renders "View detail" links with correct hrefs', () => {
    renderComponent();
    const links = screen.getAllByText('View detail');
    expect(links).toHaveLength(3);
    expect(links[0].closest('a')).toHaveAttribute('href', '/tickets/ticket-1');
    expect(links[1].closest('a')).toHaveAttribute('href', '/tickets/ticket-2');
    expect(links[2].closest('a')).toHaveAttribute('href', '/tickets/ticket-3');
  });

  test('formats event date correctly', () => {
    renderComponent();
    // UTC formatted date
    expect(screen.getByText('June 15, 2025 at 7:00 PM')).toBeInTheDocument();
    expect(screen.getByText('October 20, 2030 at 10:00 AM')).toBeInTheDocument();
  });

  test('shows "Date to be announced" when eventAt is null', () => {
    renderComponent();
    expect(screen.getByText('Date to be announced')).toBeInTheDocument();
  });
});
