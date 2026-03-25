'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { getOrCreateSessionId } from '@/lib/session';
import { createOrder, getHoldById, getHolds, getTicketById } from '@/services/tickets-service';
import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';
import type { Hold, Ticket } from '@/types/tickets';

type GroupedCheckoutItem = {
  ticketId: string;
  ticket: Ticket;
  holds: Hold[];
  quantity: number;
  totalPrice: number;
  earliestExpiration: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState('');
  const [groupedItems, setGroupedItems] = useState<GroupedCheckoutItem[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, discount, user } = useAuth();

  useEffect(() => {
    const holdIdParam = searchParams.get('holdId');
    const id = getOrCreateSessionId();
    setSessionId(id);

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        let holdsData: Hold[];
        if (holdIdParam) {
          const hold = await getHoldById(holdIdParam);
          if (hold.status !== 'active') {
            throw new Error('Hold is not active');
          }
          holdsData = [hold];
        } else {
          const allHolds = await getHolds(id);
          holdsData = allHolds.filter(h => h.status === 'active');
          if (holdsData.length === 0) {
            throw new Error('No active holds');
          }
        }

        // Group holds by ticketId
        const groupedMap = new Map<string, Hold[]>();
        holdsData.forEach(hold => {
          if (!groupedMap.has(hold.ticketId)) {
            groupedMap.set(hold.ticketId, []);
          }
          groupedMap.get(hold.ticketId)!.push(hold);
        });

        // Enrich with ticket data and calculate grouped items
        const groupedPromises = Array.from(groupedMap.entries()).map(async ([ticketId, holds]) => {
          const ticket = await getTicketById(ticketId);
          const quantity = holds.length;
          const totalPrice = quantity * ticket.price;

          // Find earliest expiration
          const earliestExpiration = holds.reduce((earliest, hold) => {
            return hold.expiresAt < earliest ? hold.expiresAt : earliest;
          }, holds[0].expiresAt);

          return {
            ticketId,
            ticket,
            holds,
            quantity,
            totalPrice,
            earliestExpiration,
          };
        });

        const groupedResults = await Promise.all(groupedPromises);
        setGroupedItems(groupedResults);

        // Pre-fill from authenticated user if available
        if (isAuthenticated && user) {
          setEmail(user.email);
          setName(user.name || '');
        } else {
          // Demo data for non-authenticated users
          setEmail('demo@example.com');
          setName('Demo User');
        }
        
        if (groupedResults.length > 0) {
          setReferenceNumber(groupedResults[0].holds[0].id.slice(0, 8));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [searchParams, isAuthenticated, user]);

  const hasDiscount = isAuthenticated && discount > 0;
  const totalPrice = groupedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountedTotalPrice = hasDiscount ? calculateDiscountedPrice(totalPrice) : totalPrice;
  const discountAmount = totalPrice - discountedTotalPrice;
  const currency = groupedItems[0]?.ticket.currency || '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || groupedItems.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const allHoldIds = groupedItems.flatMap(item => item.holds.map(hold => hold.id));
      const order = await createOrder({
        holdIds: allHoldIds,
        sessionId,
        email,
        name,
        referenceNumber,
      });
      router.replace(`/orders/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="container-app py-12 flex items-center justify-center">
      Loading checkout...
    </div>;
  }

  return (
    <main className="container-app py-12">
      <h1 className="text-4xl font-black text-white mb-8">Checkout</h1>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-xl mb-8 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="surface p-8 mb-8 rounded-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Order Items:</h2>
        
        <div className="space-y-6 mb-8">
          {groupedItems.map((item) => (
            <div key={item.ticketId} className="flex gap-6 items-start p-6 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="w-24 h-24 relative flex-shrink-0 shadow-lg rounded-xl overflow-hidden">
                <Image
                  src={item.ticket.imageUrl}
                  alt={item.ticket.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white mb-2 truncate">{item.ticket.title}</h3>
                <p className="text-lg text-gray-300 mb-2">
                  {item.ticket.eventAt ? new Date(item.ticket.eventAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : 'Date not specified'}
                </p>
                <div className="flex items-center gap-4 mb-3">
                  <p className="text-2xl font-black text-emerald-400">
                    {item.totalPrice.toLocaleString('en-US')} {item.ticket.currency}
                  </p>
                  <span className="text-lg text-gray-300">× {item.quantity}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    Status: <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium">Active</span>
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    Expires: {new Date(item.earliestExpiration).toLocaleString('en-US', { timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/30 p-6 rounded-2xl backdrop-blur-sm">
          <div className="text-right">
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
                <p className="text-4xl font-black text-emerald-400 tracking-tight mb-2">
                  {discountedTotalPrice.toLocaleString('en-US')} {currency}
                </p>
                <p className="text-xl text-emerald-300">
                  You save {discountAmount.toLocaleString('en-US')} {currency}
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black text-emerald-400 tracking-tight mb-2">
                  {totalPrice.toLocaleString('en-US')} {currency}
                </p>
                <p className="text-xl text-emerald-300">Total</p>
              </>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="surface p-8 rounded-2xl mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Your email"
            className="w-full p-4 border border-gray-600 rounded-xl bg-white/5 backdrop-blur-sm text-white placeholder-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all" 
            required 
          />
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Your name"
            className="w-full p-4 border border-gray-600 rounded-xl bg-white/5 backdrop-blur-sm text-white placeholder-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all" 
            required 
          />
        </div>
        <input 
          type="text" 
          value={referenceNumber} 
          onChange={(e) => setReferenceNumber(e.target.value)} 
          placeholder="Reference number (optional)"
          className="w-full p-4 border border-gray-600 rounded-xl bg-white/5 backdrop-blur-sm text-white placeholder-gray-400 mb-6 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all" 
        />
        <button
          type="submit"
          disabled={submitting || groupedItems.length === 0}
          className="btn-primary w-full py-5 text-xl font-bold shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting order...' : 'Confirm Order and Pay'}
        </button>
      </form>

      <Link href="/cart" className="text-sky-400 hover:text-sky-300 text-lg font-medium block text-center">
        ← Back to Cart
      </Link>
    </main>
  );
}
