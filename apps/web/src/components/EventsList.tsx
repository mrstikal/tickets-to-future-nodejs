'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getEventsByPeriod } from '@/services/tickets-service';
import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';
import type { Ticket } from '@/types/tickets';

const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

interface InitialProps {
  initialItems: Ticket[];
  initialMeta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  periodStartYear: number;
  periodEndYear: number;
}

export default function EventsList({ initialItems, initialMeta, periodStartYear, periodEndYear }: InitialProps) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, discount } = useAuth();

  const loadMore = useCallback(async () => {
    if (loading || !meta.hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getEventsByPeriod(
        periodStartYear,
        periodEndYear,
        meta.page + 1,
        meta.limit
      );

      setItems(prev => [...prev, ...response.items]);
      setMeta(response.meta);
    } catch {
      setError('Error loading more events. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [meta, periodStartYear, periodEndYear, loading]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore]);

  const renderTicketCard = (ticket: Ticket) => {
    const discountedPrice = calculateDiscountedPrice(ticket.price);
    const hasDiscount = discount > 0;
    
    return (
      <article key={ticket.id} className="surface overflow-hidden">
        <div
          className="h-[220px] bg-slate-900 bg-cover bg-center"
          style={{ backgroundImage: `url(${ticket.imageUrl})` }}
        />
        <div className="p-5">
          <h3 className="mb-2 text-2xl font-bold text-white">{ticket.title}</h3>
          <p className="mb-2 text-sky-200">
            {ticket.eventAt
              ? eventDateFormatter.format(new Date(ticket.eventAt))
              : 'Date to be announced'}
          </p>
          <p className="text-muted mb-4 leading-6">{ticket.description}</p>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              {hasDiscount ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                      -{discount}%
                    </span>
                    <span className="text-xl line-through text-gray-400">
                      {ticket.price} {ticket.currency}
                    </span>
                  </div>
                  <strong className="text-2xl text-emerald-400">
                    {discountedPrice} {ticket.currency}
                  </strong>
                </>
              ) : (
                <strong className="text-xl">
                  {ticket.price} {ticket.currency}
                </strong>
              )}
            </div>
            <span
              className={
                ticket.availableQuantity > 0
                  ? 'text-sm text-green-300'
                  : 'text-sm text-red-300'
              }
            >
              {ticket.availableQuantity > 0
                ? `${ticket.availableQuantity} available`
                : 'Sold out'}
            </span>
          </div>
          <Link href={`/tickets/${ticket.id}`} className="btn-primary">
            View detail
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="container-app py-12">
      <header className="mb-8 text-center">
        <Link href="/" className="btn-secondary mb-4 inline-flex items-center gap-2">
          ← Back to homepage
        </Link>
        <h1 className="text-4xl font-black text-white">
          All events {periodStartYear}–{periodEndYear}
        </h1>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500 text-red-300 rounded">
          {error}
          <button onClick={loadMore} className="ml-4 underline">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        {items.map(renderTicketCard)}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-muted">Loading more events...</p>
        </div>
      )}

      <div ref={loadMoreRef} className="h-10" />
    </div>
  );
}