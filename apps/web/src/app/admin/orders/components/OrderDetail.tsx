 'use client';

import { useState } from 'react';
import type { AdminOrderDetail, OrderStatus } from '@/types/admin';
import { cancelOrder, updateOrderTotalPrice } from '@/services/admin-api-client';

type OrderDetailProps = {
  order: AdminOrderDetail;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: AdminOrderDetail) => void;
};

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeColor(status: OrderStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-600';
    case 'created':
      return 'bg-yellow-600';
    case 'failed':
      return 'bg-red-600';
    case 'expired':
      return 'bg-gray-600';
    case 'cancelled':
      return 'bg-orange-600';
    default:
      return 'bg-gray-600';
  }
}

export default function OrderDetail({ order, onClose, onOrderUpdated }: OrderDetailProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [newTotalPrice, setNewTotalPrice] = useState(order.totalPrice != null ? String(order.totalPrice) : '');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = order.status === 'created' || order.status === 'confirmed';

  // Agregace položek podle ticketId - sloučí položky se stejným ticketem
  const aggregatedItems = order.items.reduce((acc, item) => {
    const existing = acc.find(i => i.ticketId === item.ticketId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalPrice += item.totalPrice;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, [] as typeof order.items);

  async function handleCancel() {
    setIsCancelling(true);
    setError(null);
    try {
      const updated = await cancelOrder(order.id);
      onOrderUpdated(updated);
      setShowCancelConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleUpdateTotalPrice() {
    const price = parseFloat(newTotalPrice);
    if (isNaN(price) || price < 0) {
      setError('Total price must be a non-negative number');
      return;
    }
    setIsUpdatingPrice(true);
    setError(null);
    try {
      const updated = await updateOrderTotalPrice(order.id, price);
      onOrderUpdated(updated);
      setNewTotalPrice(updated.totalPrice.toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update total price');
    } finally {
      setIsUpdatingPrice(false);
    }
  }

  return (
    <div className="text-white">
      <h2 className="mb-4 text-xl font-bold">Order Detail</h2>

      {error && <div className="mb-4 rounded border border-red-700 bg-red-900 p-2 text-red-300">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400">Order Number</p>
          <p className="font-semibold">{order.orderNumber}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Status</p>
          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(order.status)}`}>
            {order.status}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-400">Email</p>
          <p className="font-semibold">{order.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Name</p>
          <p className="font-semibold">{order.name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Reference Number</p>
          <p className="font-semibold">{order.referenceNumber}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Created At</p>
          <p className="font-semibold">{formatDateTime(order.createdAt)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-gray-400">Total Price</p>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={newTotalPrice}
              onChange={(e) => setNewTotalPrice(e.target.value)}
              disabled={order.status === 'cancelled' || isUpdatingPrice}
              className="w-32 rounded border border-gray-600 bg-gray-700 px-2 py-1"
            />
            <span className="font-semibold">{order.currency}</span>
            {order.status !== 'cancelled' && (
              <button
                onClick={handleUpdateTotalPrice}
                disabled={isUpdatingPrice}
                className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdatingPrice ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-bold">Items ({aggregatedItems.length})</h3>
      <table className="mb-6 w-full overflow-hidden rounded border border-gray-700">
        <thead className="bg-gray-800 text-left">
          <tr>
            <th className="p-2">Ticket Title</th>
            <th className="p-2">Quantity</th>
            <th className="p-2">Unit Price</th>
            <th className="p-2">Total Price</th>
          </tr>
        </thead>
        <tbody>
          {aggregatedItems.map((item, idx) => (
            <tr key={idx} className="border-t border-gray-700">
              <td className="p-2">{item.ticketTitle}</td>
              <td className="p-2">{item.quantity}</td>
              <td className="p-2">{item.unitPrice} {order.currency}</td>
              <td className="p-2">{item.totalPrice} {order.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between">
        <div>
          {canCancel && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="rounded bg-red-600 px-4 py-2 font-bold hover:bg-red-700"
            >
              Cancel Order
            </button>
          )}
          {showCancelConfirm && (
            <div className="flex items-center space-x-2">
              <p className="text-red-300">Are you sure you want to cancel this order?</p>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="rounded bg-red-700 px-3 py-1 text-sm hover:bg-red-800 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="rounded bg-gray-600 px-3 py-1 text-sm hover:bg-gray-700"
              >
                No
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded bg-gray-600 px-4 py-2 font-bold hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}