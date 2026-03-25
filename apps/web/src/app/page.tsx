import Link from 'next/link';
import { getEventsGroups } from '@/services/tickets-service';
import PromoBanner from '@/components/PromoBanner';

const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export default async function HomePage(): Promise<React.JSX.Element> {
  const { groups } = await getEventsGroups();

  if (!groups || groups.length === 0) {
    return (
      <main className="container-app py-12">
        <PromoBanner />
        <section>
          <header className="mb-6">
            <p className="kicker">Live events</p>
            <h2 className="text-3xl font-black text-white">Upcoming real tickets</h2>
          </header>

          <p className="text-muted text-center py-8">No upcoming events.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container-app py-12">
      <PromoBanner />
      <section>
        <header className="mb-6">
          <p className="kicker">Live events</p>
          <h2 className="text-3xl font-black text-white">Upcoming real tickets</h2>
        </header>

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
                {events.map((ticket) => (
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
                        <strong className="text-xl">
                          {ticket.price} {ticket.currency}
                        </strong>

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
                ))}
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
      </section>
    </main>
  );
}
