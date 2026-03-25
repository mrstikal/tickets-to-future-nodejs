import Link from 'next/link';
import { getEventsByPeriod } from '@/services/tickets-service';
import EventsList from '@/components/EventsList';


// Server component for initial load
export default async function EventsPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;

  if (!period) {
    return <div>Invalid period.</div>;
  }

  const [startYearStr, endYearStr] = period.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = parseInt(endYearStr, 10);

  if (isNaN(startYear) || isNaN(endYear) || endYear !== startYear + 4) {
    return <div>Invalid period.</div>;
  }

  const response = await getEventsByPeriod(startYear, endYear, 1, 20);

  if (response.meta.total === 0) {
    return (
      <div className="container-app py-12 text-center">
        <Link href="/" className="btn-secondary mb-4 inline-flex items-center gap-2">
          ← Back to homepage
        </Link>
        <h1 className="text-4xl font-black text-white mb-4">
          All events {startYear}–{endYear}
        </h1>
        <p className="text-muted">No events in this period.</p>
      </div>
    );
  }

  return (
    <EventsList
      initialItems={response.items}
      initialMeta={response.meta}
      periodStartYear={startYear}
      periodEndYear={endYear}
    />
  );
}