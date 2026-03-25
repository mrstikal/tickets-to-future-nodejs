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
};

export type HoldStatus = 'active' | 'confirmed' | 'expired' | 'cancelled';

export type Hold = {
  id: string;
  ticketId: string;
  sessionId: string;
  status: HoldStatus;
  expiresAt: string;
  ttlSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus = 'created' | 'confirmed' | 'failed' | 'expired' | 'cancelled';

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

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  name?: string;
  referenceNumber?: string;
  totalPrice: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AppError = {
  statusCode: number;
  code: string;
  message: string;
};

export type ServiceResult<T> =
  | { data: T }
  | {
  error: AppError;
};

export type CreateOrderInput = {
  holdIds: string[];
  sessionId: string;
  email: string;
  name: string;
  referenceNumber?: string;
  userId?: string;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
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
