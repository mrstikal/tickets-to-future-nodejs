export type Ticket = {
  id: string;
  ticketTypeId?: string | null;
  slug: string;
  title: string;
  description: string;
  eventAt?: string | null;
  price: number;
  currency: string;
  imageUrl: string;
  totalQuantity: number;
  soldQuantity: number;
  activeHolds: number;
  availableQuantity: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  discountedPrice?: number;
};

export type TicketsListResponse = {
  items: Ticket[];
  meta: {
    total: number;
  };
};

export type Hold = {
  id: string;
  ticketId: string;
  sessionId: string;
  status: 'active' | 'confirmed' | 'expired' | 'cancelled';
  expiresAt: string;
  ttlSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus = 'created' | 'confirmed' | 'failed' | 'expired';

export type OrderItem = {
  ticketId: string;
  ticketTitle?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  name?: string;
  referenceNumber?: string;
  currency: string;
  totalPrice: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type TicketAvailabilityUpdatedEvent = {
  type: 'ticket.availability.updated';
  ticketId: string;
  availableQuantity: number;
  soldQuantity: number;
  activeHolds: number;
  timestamp: string;
};

export type TicketHoldExpiredEvent = {
  type: 'ticket.hold.expired';
  ticketId: string;
  holdId: string;
  timestamp: string;
};

export type OrderStatusUpdatedEvent = {
  type: 'order.status.updated';
  orderId: string;
  status: string;
  timestamp: string;
};

export type HoldUpdatedEvent = {
  type: 'hold.updated';
  sessionId: string;
  hold: {
    id: string;
    ticketId: string;
    status: string;
    expiresAt: string;
  };
  timestamp: string;
};

export type WebsocketEvent =
  | TicketAvailabilityUpdatedEvent
  | TicketHoldExpiredEvent
  | OrderStatusUpdatedEvent
  | HoldUpdatedEvent
  | {
  type: 'connection.ready';
  timestamp: string;
}
  | {
  type: 'subscription.confirmed';
  channels: string[];
}
  | {
  type: 'pong';
  timestamp: string;
}
  | {
  type: 'error';
  message: string;
};

export type EventsGroupsResponse = {
  groups: Array<{
    periodStartYear: number;
    events: Ticket[];
    totalCount: number;
  }>;
};

export type EventsPaginatedResponse = {
  items: Ticket[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};
