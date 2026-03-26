import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createOrdersRepository } from '../repositories/orders-repository';
import { logger } from '../lib/logger';
import { isValidUuid } from '../lib/validators';
import type { Order, AdminOrder, ServiceResult, OrderStatus } from '../types/domain';

function createValidationError<T>(
  statusCode: number,
  code: string,
  message: string
): ServiceResult<T> {
  return {
    error: {
      statusCode,
      code,
      message,
    },
  };
}

export interface ListOrdersFilters {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  email?: string;
}

export interface PaginatedOrdersResult {
  items: AdminOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function listOrders(
  page: number,
  limit: number,
  filters?: ListOrdersFilters
): Promise<ServiceResult<PaginatedOrdersResult>> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const offset = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ordersRepository.findAll({
        limit,
        offset,
        status: filters?.status,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        email: filters?.email,
      }),
      ordersRepository.countAll({
        status: filters?.status,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        email: filters?.email,
      }),
    ]);

    const hasMore = items.length > 0 && offset + items.length < total;

    return {
      data: {
        items,
        meta: {
          total,
          page,
          limit,
          hasMore,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to list orders', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

export async function getOrderDetail(id: string): Promise<ServiceResult<Order>> {
  if (!isValidUuid(id)) {
    return createValidationError(400, 'INVALID_ID', 'Invalid order ID format.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const order = await ordersRepository.findById(id);

    if (!order) {
      return createValidationError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    }

    return { data: order };
  } catch (error) {
    logger.error('Failed to load order detail', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

export async function cancelOrder(id: string): Promise<ServiceResult<Order>> {
  if (!isValidUuid(id)) {
    return createValidationError(400, 'INVALID_ID', 'Invalid order ID format.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const order = await ordersRepository.findById(id);

    if (!order) {
      return createValidationError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    }

    // Check if order can be cancelled
    if (order.status === 'cancelled' || order.status === 'expired') {
      return createValidationError(
        409,
        'ORDER_NOT_CANCELLABLE',
        `Order cannot be cancelled because its status is ${order.status}.`
      );
    }

    const success = await ordersRepository.cancelOrder(id);

    if (!success) {
      return createValidationError(500, 'INTERNAL_ERROR', 'Failed to cancel order.');
    }

    // Return updated order
    const updatedOrder = await ordersRepository.findById(id);
    if (!updatedOrder) {
      return createValidationError(500, 'INTERNAL_ERROR', 'Failed to load updated order.');
    }

    return { data: updatedOrder };
  } catch (error) {
    logger.error('Failed to cancel order', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

export async function updateOrderTotalPrice(
  id: string,
  totalPrice: number
): Promise<ServiceResult<Order>> {
  if (!isValidUuid(id)) {
    return createValidationError(400, 'INVALID_ID', 'Invalid order ID format.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  // Validate totalPrice
  if (totalPrice < 0) {
    return createValidationError(
      400,
      'INVALID_TOTAL_PRICE',
      'Total price must be greater than or equal to 0.'
    );
  }

  try {
    const order = await ordersRepository.findById(id);

    if (!order) {
      return createValidationError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    }

    const success = await ordersRepository.updateTotalPrice(id, totalPrice);

    if (!success) {
      return createValidationError(500, 'INTERNAL_ERROR', 'Failed to update total price.');
    }

    // Return updated order
    const updatedOrder = await ordersRepository.findById(id);
    if (!updatedOrder) {
      return createValidationError(500, 'INTERNAL_ERROR', 'Failed to load updated order.');
    }

    return { data: updatedOrder };
  } catch (error) {
    logger.error('Failed to update order total price', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}
