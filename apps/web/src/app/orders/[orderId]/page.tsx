import { getOrderById } from '@/services/tickets-service';
import { OrderDetailClient } from './OrderDetailClient';

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  return <OrderDetailClient order={order} />;
}

