import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketEventForm from '../app/admin/ticket-events/components/TicketEventForm';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

vi.mock('@/services/admin-api-client');

describe('TicketEventForm', () => {
  const onSave = vi.fn(() => Promise.resolve());
  const onCancel = vi.fn();

  const ticketTypeOptions = [
    { id: 'type1', title: 'VIP Ticket' },
    { id: 'type2', title: 'Standard Ticket' },
  ];

  const initialData = {
    id: 'event123',
    ticketTypeId: 'type1',
    slug: 'vip-concert',
    title: 'VIP Concert',
    description: 'Exclusive VIP concert experience',
    eventAt: '2026-12-31T20:00:00.000Z',
    price: 5000,
    currency: 'CZK',
    totalQuantity: 100,
    soldQuantity: 10,
    isActive: true,
    imageAssetId: '123e4567-e89b-12d3-a456-426614174000',
    imageUrl: 'http://example.com/avatar.jpg',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <AuthProvider>
        {ui}
      </AuthProvider>
    );
  }

  test('renders form fields with initial data', () => {
    renderWithProviders(
      <TicketEventForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    expect(screen.getByLabelText(/ticket type/i)).toHaveValue(initialData.ticketTypeId);
    expect(screen.getByLabelText(/slug/i)).toHaveValue(initialData.slug);
    expect(screen.getByLabelText(/title/i)).toHaveValue(initialData.title);
    expect(screen.getByLabelText(/description/i)).toHaveValue(initialData.description);
    // Note: datetime-local input shows local time (UTC+1 for Prague), so 20:00 UTC becomes 21:00 local
    expect(screen.getByLabelText(/event date\/time/i)).toHaveValue('2026-12-31T21:00');
    expect(screen.getByLabelText(/price/i)).toHaveValue(initialData.price);
    expect(screen.getByLabelText(/currency/i)).toHaveValue(initialData.currency);
    expect(screen.getByLabelText(/total quantity/i)).toHaveValue(initialData.totalQuantity);
    expect(screen.getByLabelText(/sold quantity/i)).toHaveValue(initialData.soldQuantity);
    expect(screen.getByLabelText(/is active/i)).toBeChecked();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  test('renders ticketTypeOptions in dropdown', () => {
    renderWithProviders(
      <TicketEventForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    const select = screen.getByLabelText(/ticket type/i);
    expect(select).toHaveValue('type1');
    expect(screen.getByText('VIP Ticket')).toBeInTheDocument();
    expect(screen.getByText('Standard Ticket')).toBeInTheDocument();
  });

  test('validates required ticketTypeId', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={{ ...initialData, ticketTypeId: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    // Remove required attribute to bypass HTML5 validation
    const select = screen.getByLabelText(/ticket type/i);
    select.removeAttribute('required');
    
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/ticket type is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('validates required slug', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={{ ...initialData, slug: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    // Remove required attribute to bypass HTML5 validation
    const input = screen.getByLabelText(/slug/i);
    input.removeAttribute('required');
    
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/slug is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('validates required title', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={{ ...initialData, title: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    // Remove required attribute to bypass HTML5 validation
    const input = screen.getByLabelText(/title/i);
    input.removeAttribute('required');
    
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('validates required eventAt', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={{ ...initialData, eventAt: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    // Remove required attribute to bypass HTML5 validation
    const input = screen.getByLabelText(/event date\/time/i);
    input.removeAttribute('required');
    
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/event date\/time is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('validates soldQuantity > totalQuantity', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={{ ...initialData, totalQuantity: 10, soldQuantity: 15 }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/sold quantity cannot exceed total quantity/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('calls onSave with correct data when valid', async () => {
    renderWithProviders(
      <TicketEventForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Updated Concert' } });
    fireEvent.change(screen.getByLabelText(/event date\/time/i), { target: { value: '2026-12-25T19:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // Note: 2026-12-25T19:00 local time (UTC+1) converts to 2026-12-25T18:00:00.000Z UTC
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      ticketTypeId: initialData.ticketTypeId,
      slug: initialData.slug,
      title: 'Updated Concert',
      description: initialData.description,
      eventAt: '2026-12-25T18:00:00.000Z', // ISO string (UTC)
      price: initialData.price,
      currency: initialData.currency,
      totalQuantity: initialData.totalQuantity,
      soldQuantity: initialData.soldQuantity,
      isActive: initialData.isActive,
      imageAssetId: initialData.imageAssetId,
    }));
  });

  test('calls onCancel when cancel button clicked', () => {
    renderWithProviders(
      <TicketEventForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('disables buttons and shows saving text when isSaving is true', () => {
    renderWithProviders(
      <TicketEventForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={true}
        ticketTypeOptions={ticketTypeOptions}
      />
    );
    expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});