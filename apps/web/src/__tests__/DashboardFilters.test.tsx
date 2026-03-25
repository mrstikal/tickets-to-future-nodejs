import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardFilters from '@/app/admin/components/DashboardFilters';
import * as adminApiClient from '@/services/admin-api-client';

vi.mock('@/services/admin-api-client');

describe('DashboardFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const mockedGetAdminTicketTypes = adminApiClient.getAdminTicketTypes as unknown as import('vitest').Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAdminTicketTypes.mockResolvedValue({ items: [] });
  });

  it('loads ticket types on mount', async () => {
    mockedGetAdminTicketTypes.mockResolvedValue({
      items: [{ id: '1', title: 'Type 1' }],
    });

    render(<DashboardFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    await waitFor(() => {
      expect(adminApiClient.getAdminTicketTypes).toHaveBeenCalled();
    });
  });

  it('calls onFiltersChange when date range preset buttons are clicked', async () => {
    render(<DashboardFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    await waitFor(() => {
      expect(adminApiClient.getAdminTicketTypes).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Today'));
    expect(mockOnFiltersChange).toHaveBeenCalled();

    fireEvent.click(screen.getByText('This week'));
    expect(mockOnFiltersChange).toHaveBeenCalled();

    fireEvent.click(screen.getByText('This month'));
    expect(mockOnFiltersChange).toHaveBeenCalled();
  });

  it('disables event select when no ticket type selected', async () => {
    render(<DashboardFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    await waitFor(() => {
      expect(adminApiClient.getAdminTicketTypes).toHaveBeenCalled();
    });

    const eventPlaceholder = screen.getByText('First, select the ticket type');
    expect(eventPlaceholder).toBeInTheDocument();
    expect(eventPlaceholder.closest('div[aria-disabled="true"]')).not.toBeNull();
  });
});
