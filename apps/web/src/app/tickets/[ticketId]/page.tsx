import Link from 'next/link';
import { TicketDetailClient } from '@/components/ticket-detail-client';
import { getTicketById } from '@/services/tickets-service';

const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

type TicketDetailPageProps = {
  params: Promise<{
    ticketId: string;
  }>;
};

export default async function TicketDetailPage({
                                                 params,
                                               }: TicketDetailPageProps): Promise<React.JSX.Element> {
  const { ticketId } = await params;
  const ticket = await getTicketById(ticketId);

  return (
    <main className="container-app">
      <Link
        href="/tickets"
        className="mb-6 inline-block text-sky-300 hover:text-sky-200"
      >
        ← Back to tickets
      </Link>

      <section className="grid items-start gap-7 lg:grid-cols-[minmax(320px,480px)_1fr]">
        <div
          className="min-h-[420px] rounded-3xl border border-white/10 bg-slate-900 bg-cover bg-center"
          style={{ backgroundImage: `url(${ticket.imageUrl})` }}
        />

        <div>
          <p className="mb-3 text-sky-200">
            {ticket.eventAt
              ? eventDateFormatter.format(new Date(ticket.eventAt))
              : 'Date to be announced'}
          </p>

          <TicketDetailClient initialTicket={ticket} />
        </div>
      </section>
    </main>
  );
}