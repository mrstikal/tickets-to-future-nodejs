import { getEventsGroups } from '@/services/tickets-service';
import PromoBanner from '@/components/PromoBanner';
import HomeTicketGroups from '@/components/HomeTicketGroups';

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

        <HomeTicketGroups groups={groups} />
      </section>
    </main>
  );
}
