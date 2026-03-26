'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth-context';
import { calculateDiscountedPrice } from '@/lib/discount';
import type { EventsGroupsResponse } from '@/types/tickets';

const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

interface HomeTicketGroupsProps {
  groups: EventsGroupsResponse['groups'];
}

export default function HomeTicketGroups({ groups }: HomeTicketGroupsProps): React.JSX.Element {
  const { discount } = useAuth();

  return (
    <>
      {groups.map(({ periodStartYear, events, totalCount }) => {
        const periodEndYear = periodStartYear + 4;
        const hasMore = totalCount > 5;

        return (
          <div key={periodStartYear} className="mb-12">
            <header className="mb-6">
              <h3 className="text-2xl font-black text-white">
                Events {periodStartYear}–{periodEndYear}
              </h3>
            </header>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mb-6">
              {events.map((ticket) => {
                const discountedPrice = calculateDiscountedPrice(ticket.price);
                const hasDiscount = discount > 0;

                return (
                  <article key={ticket.id} className="surface overflow-hidden">
                    <div
                      className="h-[220px] bg-slate-900 bg-cover bg-center"
                      style={{ backgroundImage: `url(${ticket.imageUrl})` }}
                    />

                    <div className="p-5">
                      <h4 className="mb-2 text-2xl font-bold text-white">{ticket.title}</h4>
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
              })}
            </div>

            {hasMore && (
              <div className="text-center">
                <Link
                  href={`/events/${periodStartYear}-${periodEndYear}`}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  Show more ({totalCount - 5} more)
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}