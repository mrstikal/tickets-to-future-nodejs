import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody } from '../lib/read-json-body';
import { sendJson } from '../lib/send-json';
import { logger } from '../lib/logger';
import {
  listOrders,
  getOrderDetail,
  cancelOrder,
  updateOrderTotalPrice,
  type ListOrdersFilters,
} from '../services/admin-orders-service';
import type { OrderStatus } from '../types/domain';

export async function listOrdersHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const statusParam = url.searchParams.get('status');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const emailParam = url.searchParams.get('email');

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const filters: ListOrdersFilters = {};
    if (statusParam) filters.status = statusParam as OrderStatus;
    if (startDateParam) filters.startDate = startDateParam;
    if (endDateParam) filters.endDate = endDateParam;
    if (emailParam) filters.email = emailParam;

    const result = await listOrders(page, limit, filters);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 200, result.data);
  } catch (error) {
    logger.error('Failed to list orders:', error);
    sendJson(response, 500, {
      error: { message: 'Failed to list orders' },
    });
  }
}

export async function getOrderDetailHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const result = await getOrderDetail(id);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 200, result.data);
  } catch (error) {
    logger.error('Failed to get order detail:', error);
    sendJson(response, 500, {
      error: { message: 'Failed to get order detail' },
    });
  }
}

export async function cancelOrderHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const result = await cancelOrder(id);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 200, result.data);
  } catch (error) {
    logger.error('Failed to cancel order:', error);
    sendJson(response, 500, {
      error: { message: 'Failed to cancel order' },
    });
  }
}

export async function updateOrderTotalPriceHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const body = await readJsonBody<{ totalPrice?: unknown }>(request);

    if (typeof body.totalPrice !== 'number') {
      sendJson(response, 400, {
        error: { message: 'totalPrice must be a number' },
      });
      return;
    }

    const result = await updateOrderTotalPrice(id, body.totalPrice);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 200, result.data);
  } catch (error) {
    logger.error('Failed to update order total price:', error);
    sendJson(response, 500, {
      error: { message: 'Failed to update order total price' },
    });
  }
}
