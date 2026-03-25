export type AdminStatsOverview = {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  ticketsSold: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
  }>;
};

export type AdminTopSellingItem = {
  ticketId: string;
  title: string;
  imageUrl: string;
  eventAt: string;
  soldQuantity: number;
  totalQuantity: number;
  revenue: number;
  sellThroughPercent: number;
};

export type AdminTopSellingResponse = {
  items: AdminTopSellingItem[];
};

export type AdminLeastSellingResponse = {
  items: AdminTopSellingItem[];
};

export type AdminTicketTypeFilter = {
  id: string;
  title: string;
};

export type AdminTicketEventFilter = {
  id: string;
  title: string;
  eventAt: string;
};

export type AdminFiltersResponse = {
  items: AdminTicketTypeFilter[] | AdminTicketEventFilter[];
};

export type AdminTicketTypesResponse = {
  items: AdminTicketTypeFilter[];
};

export type TicketType = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  imageAssetId: string;
  imageUrl?: string;
  totalQuantity: number;
  soldQuantity: number;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedTicketTypesResponse = {
  items: TicketType[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export type AdminTicketEventsResponse = {
  items: AdminTicketEventFilter[];
};

export type TicketEvent = {
  id: string;
  ticketTypeId: string;
  slug: string;
  title: string;
  description: string;
  eventAt: string;
  price: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
  isActive: boolean;
  imageAssetId: string | null;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedTicketEventsResponse = {
  items: TicketEvent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export type DashboardFilters = {
  startDate?: Date;
  endDate?: Date;
  ticketTypeId?: string;
  ticketEventId?: string;
};

export type OrderStatus = 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';

export type AdminOrderItem = {
  ticketId: string;
  ticketTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  name: string;
  referenceNumber: string;
  totalPrice: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDetail = AdminOrder & {
  items: AdminOrderItem[];
};

export type PaginatedOrdersResponse = {
  items: AdminOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export type OrderFilters = {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  email?: string;
};
