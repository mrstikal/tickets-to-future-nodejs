import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrderDetail from '../app/admin/orders/components/OrderDetail';
import { vi } from 'vitest';
import type { AdminOrderDetail } from '@/types/admin';

vi.mock('@/services/admin-api-client');

describe('OrderDetail', () => {
  const mockOrder: AdminOrderDetail = {
    id: 'order123',
    orderNumber: 'ORD-2026-001',
    status: 'created',
    email: 'customer@example.com',
    name: 'John Doe',
    referenceNumber: 'REF-12345',
    totalPrice: 5000,
    currency: 'CZK',
    itemCount: 2,
    createdAt: '2026-03-23T10:00:00.000Z',
    updatedAt: '2026-03-23T10:00:00.000Z',
    items: [
      {
        ticketId: 'ticket1',
        ticketTitle: 'VIP Concert',
        quantity: 1,
        unitPrice: 3000,
        totalPrice: 3000,
      },
      {
        ticketId: 'ticket2',
        ticketTitle: 'Standard Ticket',
        quantity: 2,
        unitPrice: 1000,
        totalPrice: 2000,
      },
    ],
  };

  const onClose = vi.fn();
  const onOrderUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders order info correctly', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.getByText('Order Detail')).toBeInTheDocument();
    expect(screen.getByText(mockOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.email)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.name)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.referenceNumber)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.status)).toBeInTheDocument();
  });

  test('renders order items in table', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.getByText('VIP Concert')).toBeInTheDocument();
    expect(screen.getByText('Standard Ticket')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('displays total price input and currency', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    const priceInput = screen.getByDisplayValue('5000');
    expect(priceInput).toBeInTheDocument();
    expect(screen.getByText('CZK')).toBeInTheDocument();
  });

  test('shows Cancel Order button for created status', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.getByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  test('shows Cancel Order button for confirmed status', () => {
    const confirmedOrder = { ...mockOrder, status: 'confirmed' as const };
    render(
      <OrderDetail
        order={confirmedOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.getByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  test('hides Cancel Order button for cancelled status', () => {
    const cancelledOrder = { ...mockOrder, status: 'cancelled' as const };
    render(
      <OrderDetail
        order={cancelledOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  test('hides Cancel Order button for expired status', () => {
    const expiredOrder = { ...mockOrder, status: 'expired' as const };
    render(
      <OrderDetail
        order={expiredOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  test('hides Cancel Order button for failed status', () => {
    const failedOrder = { ...mockOrder, status: 'failed' as const };
    render(
      <OrderDetail
        order={failedOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  test('shows Save button for total price when status is not cancelled', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  test('hides Save button for total price when status is cancelled', () => {
    const cancelledOrder = { ...mockOrder, status: 'cancelled' as const };
    render(
      <OrderDetail
        order={cancelledOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  test('disables total price input when status is cancelled', () => {
    const cancelledOrder = { ...mockOrder, status: 'cancelled' as const };
    render(
      <OrderDetail
        order={cancelledOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    const priceInput = screen.getByDisplayValue('5000');
    expect(priceInput).toBeDisabled();
  });

  test('shows confirmation dialog when Cancel Order button clicked', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));

    expect(screen.getByText(/are you sure you want to cancel this order/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^no$/i })).toBeInTheDocument();
  });

  test('hides confirmation dialog when No button clicked', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    expect(screen.getByText(/are you sure you want to cancel this order/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(screen.queryByText(/are you sure you want to cancel this order/i)).not.toBeInTheDocument();
  });

  test('calls cancelOrder API and onOrderUpdated when confirming cancel', async () => {
    const { cancelOrder } = await import('@/services/admin-api-client');
    const cancelOrderMock = vi.mocked(cancelOrder);
    const updatedOrder = { ...mockOrder, status: 'cancelled' as const };
    cancelOrderMock.mockResolvedValue(updatedOrder);

    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel/i }));

    await waitFor(() => {
      expect(cancelOrderMock).toHaveBeenCalledWith(mockOrder.id);
      expect(onOrderUpdated).toHaveBeenCalledWith(updatedOrder);
    });
  });

  test('displays error message when cancelOrder fails', async () => {
    const { cancelOrder } = await import('@/services/admin-api-client');
    const cancelOrderMock = vi.mocked(cancelOrder);
    cancelOrderMock.mockRejectedValue(new Error('API error'));

    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel/i }));

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument();
    });
  });

  test('calls updateOrderTotalPrice API when Save button clicked', async () => {
    const { updateOrderTotalPrice } = await import('@/services/admin-api-client');
    const updateOrderTotalPriceMock = vi.mocked(updateOrderTotalPrice);
    const updatedOrder = { ...mockOrder, totalPrice: 6000 };
    updateOrderTotalPriceMock.mockResolvedValue(updatedOrder);

    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    const priceInput = screen.getByDisplayValue('5000');
    fireEvent.change(priceInput, { target: { value: '6000' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(updateOrderTotalPriceMock).toHaveBeenCalledWith(mockOrder.id, 6000);
      expect(onOrderUpdated).toHaveBeenCalledWith(updatedOrder);
    });
  });

  test('displays error when total price is negative', async () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    const priceInput = screen.getByDisplayValue('5000');
    fireEvent.change(priceInput, { target: { value: '-100' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/total price must be a non-negative number/i)).toBeInTheDocument();
    });
  });

  test('displays error when total price is invalid', async () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    const priceInput = screen.getByDisplayValue('5000');
    fireEvent.change(priceInput, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/total price must be a non-negative number/i)).toBeInTheDocument();
    });
  });

  test('calls onClose when Close button clicked', () => {
    render(
      <OrderDetail
        order={mockOrder}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('aggregates items with same ticketId', () => {
    const orderWithDuplicates: AdminOrderDetail = {
      ...mockOrder,
      items: [
        {
          ticketId: 'ticket1',
          ticketTitle: 'VIP Concert',
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
        },
        {
          ticketId: 'ticket1',
          ticketTitle: 'VIP Concert',
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
        },
      ],
    };

    render(
      <OrderDetail
        order={orderWithDuplicates}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    // Should show aggregated quantity (2) not individual items
    const rows = screen.getAllByText('VIP Concert');
    expect(rows).toHaveLength(1); // Only one row for aggregated item
  });
});
