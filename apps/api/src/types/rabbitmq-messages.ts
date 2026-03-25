import type { OrderItem } from './domain';

export interface RabbitmqEventMessage {
  eventType: string;
  occurredAt: string;
}

export interface OrderConfirmedMessage extends RabbitmqEventMessage {
  eventType: 'order.confirmed';
  orderId: string;
  orderNumber: string;
  email: string;
  items: OrderItem[];
  totalPrice: number;
  currency: string;
}

export interface HoldExpiredMessage extends RabbitmqEventMessage {
  eventType: 'hold.expired';
  holdId: string;
  ticketId: string;
  sessionId: string;
}