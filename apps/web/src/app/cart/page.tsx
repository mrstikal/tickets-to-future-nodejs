'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getOrCreateSessionId } from '@/lib/session';
import { getHolds, getTicketById, createHold, cancelHold } from '@/services/tickets-service';
import { useSessionWebsocket } from '@/hooks/use-session-websocket';
import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';

import type { Hold, Ticket, WebsocketEvent } from '@/types/tickets';

type GroupedCartItem = {
  ticketId: string;
  ticket: Ticket;
  holds: Hold[];
  quantity: number;
  totalPrice: number;
  availableQuantity: number;
};

export default function CartPage() {
  const [groupedItems, setGroupedItems] = useState<GroupedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, discount } = useAuth();

  const loadCart = async () => {
    const sessionId = getOrCreateSessionId();

    setLoading(true);
    setError(null);

    try {
      const holdsData = await getHolds(sessionId);

      // Group holds by ticketId
      const groupedMap = new Map<string, Hold[]>();

      holdsData.forEach(hold => {
        if (!groupedMap.has(hold.ticketId)) {
          groupedMap.set(hold.ticketId, []);
        }
        groupedMap.get(hold.ticketId)!.push(hold);
      });

      // Enrich with ticket data
      const enrichedPromises = Array.from(groupedMap.entries()).map(async ([ticketId, holds]) => {
        const ticket = await getTicketById(ticketId);
        const quantity = holds.filter(h => h.status === 'active').length;
        const totalPrice = quantity * ticket.price;

        return {
          ticketId,
          ticket,
          holds,
          quantity,
          totalPrice,
          availableQuantity: ticket.availableQuantity,
        };
      });

      const enrichedResults = await Promise.all(enrichedPromises);
      setGroupedItems(enrichedResults);

    } catch (error) {
      console.error('Error loading cart:', error);
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const refreshCartData = async () => {
    const sessionId = getOrCreateSessionId();

    try {
      const holdsData = await getHolds(sessionId);

      // Group holds by ticketId
      const groupedMap = new Map<string, Hold[]>();

      holdsData.forEach(hold => {
        if (!groupedMap.has(hold.ticketId)) {
          groupedMap.set(hold.ticketId, []);
        }
        groupedMap.get(hold.ticketId)!.push(hold);
      });

      // Enrich with ticket data
      const enrichedPromises = Array.from(groupedMap.entries()).map(async ([ticketId, holds]) => {
        const ticket = await getTicketById(ticketId);
        const quantity = holds.filter(h => h.status === 'active').length;
        const totalPrice = quantity * ticket.price;

        return {
          ticketId,
          ticket,
          holds,
          quantity,
          totalPrice,
          availableQuantity: ticket.availableQuantity,
        };
      });

      const enrichedResults = await Promise.all(enrichedPromises);
      setGroupedItems(enrichedResults);

    } catch (error) {
      console.error('Error refreshing cart data:', error);
      // Don't set error state here to avoid disrupting UI
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  // WebSocket for real-time updates
  useSessionWebsocket({
    onEvent: (event: WebsocketEvent) => {
      if (event.type === 'hold.updated') {
        refreshCartData();
      }
    },
  });

  const handleIncreaseQuantity = async (ticketId: string) => {
    const sessionId = getOrCreateSessionId();
    const itemIndex = groupedItems.findIndex(i => i.ticketId === ticketId);
    const item = groupedItems[itemIndex];

    if (!item || item.quantity >= 10) {
      setError('Maximum 10 tickets per person');
      return;
    }

    if (item.availableQuantity <= 0) {
      setError('Not enough tickets available');
      return;
    }

    setOperationLoading(ticketId);
    setError(null);

    // Optimistic update
    const newQuantity = item.quantity + 1;
    const newTotalPrice = newQuantity * item.ticket.price;
    const newGroupedItems = [...groupedItems];
    newGroupedItems[itemIndex] = {
      ...item,
      quantity: newQuantity,
      totalPrice: newTotalPrice,
    };
    setGroupedItems(newGroupedItems);

    try {
      await createHold({ ticketId, sessionId });
      // WebSocket will handle the real update
    } catch (error) {
      console.error('Error increasing quantity:', error);
      setError('Failed to add ticket to cart');
      // Rollback optimistic update
      setGroupedItems(groupedItems);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleDecreaseQuantity = async (ticketId: string) => {
    const itemIndex = groupedItems.findIndex(i => i.ticketId === ticketId);
    const item = groupedItems[itemIndex];
    if (!item || item.quantity <= 1) return;

    const activeHolds = item.holds.filter(h => h.status === 'active');
    if (activeHolds.length === 0) return;

    const holdToCancel = activeHolds[0];

    setOperationLoading(ticketId);
    setError(null);

    // Optimistic update
    const newQuantity = item.quantity - 1;
    const newTotalPrice = newQuantity * item.ticket.price;
    const newGroupedItems = [...groupedItems];
    newGroupedItems[itemIndex] = {
      ...item,
      quantity: newQuantity,
      totalPrice: newTotalPrice,
    };
    setGroupedItems(newGroupedItems);

    try {
      await cancelHold(holdToCancel.id);
      // WebSocket will handle the real update
    } catch (error) {
      console.error('Error decreasing quantity:', error);
      setError('Failed to remove ticket from cart');
      // Rollback optimistic update
      setGroupedItems(groupedItems);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleRemoveTicket = async (ticketId: string) => {
    const itemIndex = groupedItems.findIndex(i => i.ticketId === ticketId);
    const item = groupedItems[itemIndex];
    if (!item) return;

    const activeHolds = item.holds.filter(h => h.status === 'active');

    setOperationLoading(ticketId);
    setError(null);

    // Optimistic update
    const newGroupedItems = groupedItems.filter(i => i.ticketId !== ticketId);
    setGroupedItems(newGroupedItems);

    try {
      await Promise.all(activeHolds.map(hold => cancelHold(hold.id)));
      // WebSocket will handle the real update
    } catch (error) {
      console.error('Error removing ticket:', error);
      setError('Failed to remove ticket from cart');
      // Rollback optimistic update
      setGroupedItems(groupedItems);
    } finally {
      setOperationLoading(null);
    }
  };

  const activeItems = groupedItems.filter(item => item.quantity > 0);

  if (loading) return <div className="container-app py-12 flex items-center justify-center">Loading cart...</div>;

  const hasDiscount = isAuthenticated && discount > 0;
  const totalPrice = activeItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountedTotalPrice = hasDiscount ? calculateDiscountedPrice(totalPrice) : totalPrice;
  const discountAmount = totalPrice - discountedTotalPrice;
  const currency = activeItems[0]?.ticket.currency || '';

  return (
    <main className="container-app py-12">
      <h1 className="text-4xl font-black text-white mb-8">Cart</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {activeItems.length === 0 ? (
        <p className="text-gray-400 text-center py-12">
          Your cart is empty. <Link href="/tickets" className="text-sky-300 hover:underline">Browse tickets</Link>
        </p>
      ) : (
        <>
          {activeItems.map((item) => (
            <div key={item.ticketId} className="surface-muted p-6 mb-6 flex gap-6 items-start rounded-xl">
              <div className="w-28 h-28 relative flex-shrink-0 shadow-lg rounded-xl overflow-hidden">
                <Image
                  src={item.ticket.imageUrl}
                  alt={item.ticket.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-white mb-2 truncate pr-4">{item.ticket.title}</h3>
                <p className="text-lg text-gray-300 mb-3">
                  {item.ticket.eventAt ? new Date(item.ticket.eventAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : 'Date not specified'}
                </p>

                {/* Quantity Controls */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecreaseQuantity(item.ticketId)}
                      disabled={item.quantity <= 1 || operationLoading === item.ticketId}
                      className="w-8 h-8 rounded-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="text-xl font-bold text-white min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleIncreaseQuantity(item.ticketId)}
                      disabled={item.quantity >= 10 || item.availableQuantity <= 0 || operationLoading === item.ticketId}
                      className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm text-gray-400">
                    {item.availableQuantity > 0 ? `${item.availableQuantity} available` : 'Sold out'}
                  </div>
                  <button
                    onClick={() => handleRemoveTicket(item.ticketId)}
                    disabled={operationLoading === item.ticketId}
                    className="text-red-400 hover:text-red-300 text-sm underline disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>

                <div className="mb-4">
                  {hasDiscount ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                          -{discount}%
                        </span>
                        <span className="text-xl line-through text-gray-400">
                          {item.totalPrice.toLocaleString('en-US')} {item.ticket.currency}
                        </span>
                      </div>
                      <p className="text-3xl font-black text-emerald-400">
                        {calculateDiscountedPrice(item.totalPrice).toLocaleString('en-US')} {item.ticket.currency}
                      </p>
                    </>
                  ) : (
                    <p className="text-3xl font-black text-emerald-400">
                      {item.totalPrice.toLocaleString('en-US')} {item.ticket.currency}
                    </p>
                  )}
                </div>

                <div className="text-sm text-gray-400">
                  Expires: {item.holds.find(h => h.status === 'active') ?
                    new Date(item.holds.find(h => h.status === 'active')!.expiresAt).toLocaleString('en-US', { timeStyle: 'short' }) :
                    'N/A'
                  }
                </div>
              </div>
            </div>
          ))}

          {activeItems.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 p-8 rounded-2xl mb-8 backdrop-blur-sm">
              <div className="text-right mb-6">
                {hasDiscount ? (
                  <>
                    <div className="flex items-center justify-end gap-2 mb-2">
                      <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                        -{discount}%
                      </span>
                      <span className="text-2xl line-through text-gray-400">
                        {totalPrice.toLocaleString('en-US')} {currency}
                      </span>
                    </div>
                    <p className="text-5xl font-black text-emerald-400 tracking-tight">
                      {discountedTotalPrice.toLocaleString('en-US')} {currency}
                    </p>
                    <p className="text-lg text-emerald-300">
                      You save {discountAmount.toLocaleString('en-US')} {currency}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-black text-emerald-400 tracking-tight">
                      {totalPrice.toLocaleString('en-US')} {currency}
                    </p>
                    <p className="text-lg text-emerald-300">Total</p>
                  </>
                )}
              </div>
              <Link
                href="/checkout"
                className="btn-primary w-full py-4 text-xl font-bold shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300"
              >
                Proceed to Checkout →
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
