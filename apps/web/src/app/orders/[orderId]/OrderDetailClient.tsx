'use client';

import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';
import type { Order } from '@/types/tickets';

type GroupedOrderItem = {
  ticketId: string;
  ticketTitle: string;
  quantity: number;
  totalPrice: number;
};

interface OrderDetailClientProps {
  order: Order;
}

export function OrderDetailClient({ order }: OrderDetailClientProps) {
  const { isAuthenticated, discount } = useAuth();

  // Group items by ticketId
  const groupedItems = order.items.reduce<GroupedOrderItem[]>((acc, item) => {
    const existingItem = acc.find(i => i.ticketId === item.ticketId);
    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.totalPrice += item.totalPrice;
    } else {
      acc.push({
        ticketId: item.ticketId,
        ticketTitle: item.ticketTitle || item.ticketId,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
      });
    }
    return acc;
  }, []);

  const hasDiscount = isAuthenticated && discount > 0;
  const discountedTotalPrice = hasDiscount ? calculateDiscountedPrice(order.totalPrice) : order.totalPrice;

  return (
    <main className="container-app py-12">
      <section className="surface max-w-3xl p-7">
        <p className="kicker">Order detail</p>
        <h1 className="mb-5 text-4xl font-black text-white">#{order.orderNumber}</h1>

        <div className="surface-muted mb-6 grid gap-2 p-4">
          <div>
            <strong>Status:</strong> {order.status}
          </div>
          <div>
            <strong>Email:</strong> {order.email}
          </div>
          <div>
            <strong>Total:</strong>
            {hasDiscount ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                  -{discount}%
                </span>
                <span className="text-lg line-through text-gray-400">
                  {order.totalPrice} {order.currency}
                </span>
                <span className="text-xl font-bold text-emerald-400">
                  {discountedTotalPrice} {order.currency}
                </span>
              </div>
            ) : (
              <span> {order.totalPrice} {order.currency}</span>
            )}
          </div>
          <div>
            <strong>Created at:</strong>{' '}
            {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>

        <h2 className="mb-3 text-2xl font-bold text-white">Items</h2>

        <div className="grid gap-3">
          {groupedItems.map((item) => {
            const itemDiscountedPrice = hasDiscount ? calculateDiscountedPrice(item.totalPrice) : item.totalPrice;
            
            return (
              <article
                key={`${order.id}-${item.ticketId}`}
                className="rounded-xl border border-white/10 bg-slate-900/70 p-4"
              >
                <div>
                  <strong>Ticket:</strong> {item.ticketTitle}
                </div>
                <div>
                  <strong>Quantity:</strong> {item.quantity}
                </div>
                <div>
                  <strong>Total:</strong>
                  {hasDiscount ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                        -{discount}%
                      </span>
                      <span className="text-lg line-through text-gray-400">
                        {item.totalPrice} {order.currency}
                      </span>
                      <span className="text-xl font-bold text-emerald-400">
                        {itemDiscountedPrice} {order.currency}
                      </span>
                    </div>
                  ) : (
                    <span> {item.totalPrice} {order.currency}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}