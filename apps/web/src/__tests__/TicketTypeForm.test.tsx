import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketTypeForm from '../app/admin/ticket-types/components/TicketTypeForm';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth-context';

vi.mock('@/services/admin-api-client');

describe('TicketTypeForm', () => {
  const onSave = vi.fn(() => Promise.resolve());
  const onCancel = vi.fn();

  const initialData = {
    id: 'id123',
    title: 'VIP Ticket',
    description: 'Access to VIP lounge',
    isActive: true,
    imageAssetId: '123e4567-e89b-12d3-a456-426614174000',
    imageUrl: 'http://example.com/avatar.jpg',
    totalQuantity: 100,
    soldQuantity: 10,
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
      <TicketTypeForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue(initialData.title);
    expect(screen.getByLabelText(/description/i)).toHaveValue(initialData.description);
    expect(screen.getByLabelText(/is active/i)).toBeChecked();
    expect(screen.getByLabelText(/total quantity/i)).toHaveValue(initialData.totalQuantity);
    expect(screen.getByLabelText(/sold quantity/i)).toHaveValue(initialData.soldQuantity);
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  test('validates required title field', async () => {
    renderWithProviders(
      <TicketTypeForm
        initialData={{ ...initialData, title: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    );
    // Submit the form (avoid native required blocking) and expect our validation error
    const saveBtn = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;
    if (saveBtn.form) {
      fireEvent.submit(saveBtn.form);
    } else {
      fireEvent.click(saveBtn);
    }
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('validates required avatar image', async () => {
    renderWithProviders(
      <TicketTypeForm
        initialData={{ ...initialData, imageAssetId: '' }}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/avatar image is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('calls onSave with form data when valid', async () => {
    renderWithProviders(
      <TicketTypeForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Title' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Title',
      description: initialData.description,
      isActive: initialData.isActive,
      imageAssetId: initialData.imageAssetId,
      totalQuantity: initialData.totalQuantity,
      soldQuantity: initialData.soldQuantity,
    }));
  });

  test('calls onCancel when cancel button clicked', () => {
    renderWithProviders(
      <TicketTypeForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('disables buttons and shows saving text when isSaving is true', () => {
    renderWithProviders(
      <TicketTypeForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={true}
      />
    );
    expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
