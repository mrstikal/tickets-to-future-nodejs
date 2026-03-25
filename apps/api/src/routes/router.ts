import { URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getHealth,
  getDependenciesHealth,
} from '../controllers/health-controller';
import {
  listTicketsHandler,
  getTicketDetailHandler,
  getEventsGroupsHandler,
  getEventsByPeriodHandler,
} from '../controllers/tickets-controller';
import {
  createHoldHandler,
  getHoldHandler,
  cancelHoldHandler,
  getHoldsBySessionHandler,
} from '../controllers/holds-controller';
import {
  createOrderHandler,
  getOrderHandler,
} from '../controllers/orders-controller';
import {
  loginHandler,
  refreshTokenHandler,
  meHandler,
  logoutHandler,
  signUpHandler,
} from '../controllers/auth-controller';
import {
  getAdminStatsOverviewHandler,
  getAdminStatsTopSellingHandler,
  getAdminStatsLeastSellingHandler,
  getAdminFiltersTicketTypesHandler,
  getAdminFiltersTicketEventsHandler,
  resetLoginLimit,
} from '../controllers/admin-controller';
import { requireAdmin } from '../middleware/require-admin';
import { sendJson } from '../lib/send-json';
import { logger } from '../lib/logger';

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ...params: string[]) => Promise<void> | void;
type Middleware = (req: IncomingMessage, res: ServerResponse) => Promise<unknown>;

interface Route {
  method: string;
  pattern: string | RegExp;
  handler: RouteHandler;
  middleware?: Middleware[];
}

function createRouteMatcher(pattern: string | RegExp): (pathname: string) => string[] | null {
  if (typeof pattern === 'string') {
    return (pathname: string) => pathname === pattern ? [] : null;
  }
  // RegExp pattern
  return (pathname: string) => {
    const match = pathname.match(pattern);
    if (!match) return null;
    // Return capture groups (skip full match at index 0)
    return match.slice(1);
  };
}

async function applyMiddleware(
  middlewareList: Middleware[],
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  for (const middleware of middlewareList) {
    const shouldContinue = await middleware(req, res);
    if (!shouldContinue) return false;
  }
  return true;
}

export function createRouter() {
  // Define all routes in a table, ordered from most specific to most general
  const routes: Route[] = [
    // Health endpoints
    { method: 'GET', pattern: '/', handler: getHealth },
    { method: 'GET', pattern: '/api/v1/health', handler: getHealth },
    { method: 'GET', pattern: '/api/v1/health/dependencies', handler: getDependenciesHealth },

    // Tickets
    { method: 'GET', pattern: '/api/v1/tickets', handler: listTicketsHandler },
    { method: 'GET', pattern: /^\/api\/v1\/tickets\/([^/]+)$/, handler: getTicketDetailHandler },

    // Holds
    { method: 'POST', pattern: '/api/v1/holds', handler: createHoldHandler },
    { method: 'GET', pattern: /^\/api\/v1\/holds\/session\/([^/]+)$/, handler: getHoldsBySessionHandler },
    { method: 'GET', pattern: /^\/api\/v1\/holds\/([^/]+)$/, handler: getHoldHandler },
    { method: 'DELETE', pattern: /^\/api\/v1\/holds\/([^/]+)$/, handler: cancelHoldHandler },

    // Orders
    { method: 'POST', pattern: '/api/v1/orders', handler: createOrderHandler },
    { method: 'GET', pattern: /^\/api\/v1\/orders\/([^/]+)$/, handler: getOrderHandler },

    // Events
    { method: 'GET', pattern: '/api/v1/events/groups', handler: getEventsGroupsHandler },
    { method: 'GET', pattern: '/api/v1/events', handler: getEventsByPeriodHandler },

    // Auth
    { method: 'POST', pattern: '/api/v1/auth/login', handler: loginHandler },
    { method: 'POST', pattern: '/api/v1/auth/signup', handler: signUpHandler },
    { method: 'POST', pattern: '/api/v1/auth/refresh', handler: refreshTokenHandler },
    { method: 'GET', pattern: '/api/v1/auth/me', handler: meHandler },
    { method: 'POST', pattern: '/api/v1/auth/logout', handler: logoutHandler },

    // Admin routes - all require admin authentication
    { method: 'GET', pattern: '/api/v1/admin/stats/overview', handler: getAdminStatsOverviewHandler, middleware: [requireAdmin] },
    { method: 'GET', pattern: '/api/v1/admin/stats/top-selling', handler: getAdminStatsTopSellingHandler, middleware: [requireAdmin] },
    { method: 'GET', pattern: '/api/v1/admin/stats/least-selling', handler: getAdminStatsLeastSellingHandler, middleware: [requireAdmin] },
    { method: 'GET', pattern: '/api/v1/admin/filters/ticket-types', handler: getAdminFiltersTicketTypesHandler, middleware: [requireAdmin] },
    { method: 'GET', pattern: '/api/v1/admin/filters/ticket-events', handler: getAdminFiltersTicketEventsHandler, middleware: [requireAdmin] },
    { method: 'POST', pattern: '/api/v1/admin/reset-login-limit', handler: resetLoginLimit, middleware: [requireAdmin] },

    // Admin ticket types routes
    { method: 'GET', pattern: '/api/v1/admin/ticket-types', handler: async (req, res) => {
      const { listTicketTypesHandler } = await import('../controllers/ticket-types-controller');
      await listTicketTypesHandler(req, res);
    }, middleware: [requireAdmin] },
    { method: 'GET', pattern: /^\/api\/v1\/admin\/ticket-types\/([^/]+)\/has-events$/, handler: async (req, res, params) => {
      const { checkTicketTypeHasEventsHandler } = await import('../controllers/ticket-types-controller');
      await checkTicketTypeHasEventsHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'DELETE', pattern: /^\/api\/v1\/admin\/ticket-types\/([^/]+)\/force$/, handler: async (req, res, params) => {
      const { forceDeleteTicketTypeHandler } = await import('../controllers/ticket-types-controller');
      await forceDeleteTicketTypeHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'GET', pattern: /^\/api\/v1\/admin\/ticket-types\/([^/]+)$/, handler: async (req, res, params) => {
      const { getTicketTypeHandler } = await import('../controllers/ticket-types-controller');
      await getTicketTypeHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'POST', pattern: '/api/v1/admin/ticket-types', handler: async (req, res) => {
      const { createTicketTypeHandler } = await import('../controllers/ticket-types-controller');
      await createTicketTypeHandler(req, res);
    }, middleware: [requireAdmin] },
    { method: 'PUT', pattern: /^\/api\/v1\/admin\/ticket-types\/([^/]+)$/, handler: async (req, res, params) => {
      const { updateTicketTypeHandler } = await import('../controllers/ticket-types-controller');
      await updateTicketTypeHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'DELETE', pattern: /^\/api\/v1\/admin\/ticket-types\/([^/]+)$/, handler: async (req, res, params) => {
      const { deleteTicketTypeHandler } = await import('../controllers/ticket-types-controller');
      await deleteTicketTypeHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },

    // Admin ticket events routes
    { method: 'GET', pattern: '/api/v1/admin/ticket-events', handler: async (req, res) => {
      const { listTicketEventsHandler } = await import('../controllers/ticket-events-controller');
      await listTicketEventsHandler(req, res);
    }, middleware: [requireAdmin] },
    { method: 'GET', pattern: /^\/api\/v1\/admin\/ticket-events\/([^/]+)\/has-holds-or-orders$/, handler: async (req, res, params) => {
      const { checkTicketEventHasHoldsOrOrdersHandler } = await import('../controllers/ticket-events-controller');
      await checkTicketEventHasHoldsOrOrdersHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'DELETE', pattern: /^\/api\/v1\/admin\/ticket-events\/([^/]+)\/force$/, handler: async (req, res, params) => {
      const { forceDeleteTicketEventHandler } = await import('../controllers/ticket-events-controller');
      await forceDeleteTicketEventHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'GET', pattern: /^\/api\/v1\/admin\/ticket-events\/([^/]+)$/, handler: async (req, res, params) => {
      const { getTicketEventHandler } = await import('../controllers/ticket-events-controller');
      await getTicketEventHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'POST', pattern: '/api/v1/admin/ticket-events', handler: async (req, res) => {
      const { createTicketEventHandler } = await import('../controllers/ticket-events-controller');
      await createTicketEventHandler(req, res);
    }, middleware: [requireAdmin] },
    { method: 'PUT', pattern: /^\/api\/v1\/admin\/ticket-events\/([^/]+)$/, handler: async (req, res, params) => {
      const { updateTicketEventHandler } = await import('../controllers/ticket-events-controller');
      await updateTicketEventHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'DELETE', pattern: /^\/api\/v1\/admin\/ticket-events\/([^/]+)$/, handler: async (req, res, params) => {
      const { deleteTicketEventHandler } = await import('../controllers/ticket-events-controller');
      await deleteTicketEventHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },

    // Admin orders routes
    { method: 'GET', pattern: '/api/v1/admin/orders', handler: async (req, res) => {
      const { listOrdersHandler } = await import('../controllers/admin-orders-controller');
      await listOrdersHandler(req, res);
    }, middleware: [requireAdmin] },
    { method: 'POST', pattern: /^\/api\/v1\/admin\/orders\/([^/]+)\/cancel$/, handler: async (req, res, params) => {
      const { cancelOrderHandler } = await import('../controllers/admin-orders-controller');
      await cancelOrderHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'PATCH', pattern: /^\/api\/v1\/admin\/orders\/([^/]+)\/total-price$/, handler: async (req, res, params) => {
      const { updateOrderTotalPriceHandler } = await import('../controllers/admin-orders-controller');
      await updateOrderTotalPriceHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },
    { method: 'GET', pattern: /^\/api\/v1\/admin\/orders\/([^/]+)$/, handler: async (req, res, params) => {
      const { getOrderDetailHandler } = await import('../controllers/admin-orders-controller');
      await getOrderDetailHandler(req, res, params[0]);
    }, middleware: [requireAdmin] },

    // Image assets upload
    { method: 'POST', pattern: '/api/v1/admin/image-assets/upload', handler: async (req, res) => {
      const { uploadImageAssetHandler } = await import('../controllers/image-assets-controller');
      await uploadImageAssetHandler(req, res);
    }, middleware: [requireAdmin] },
  ];

  // Precompile matchers for performance
  const compiledRoutes = routes.map(route => ({
    ...route,
    matcher: createRouteMatcher(route.pattern),
  }));

  return async function route(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      const { pathname } = url;
      const method = request.method || 'GET';

      // Find matching route
      for (const route of compiledRoutes) {
        if (route.method !== method) continue;
        
        const params = route.matcher(pathname);
        if (params === null) continue;

        // Apply middleware if any
        if (route.middleware && route.middleware.length > 0) {
          const shouldContinue = await applyMiddleware(route.middleware, request, response);
          if (!shouldContinue) return;
        }

        // Call handler with extracted parameters
        await route.handler(request, response, ...params);
        return;
      }

      // No route matched
      sendJson(response, 404, {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route was not found.',
        },
      });
    } catch (error) {
      logger.error('Request handler error', error);
      sendJson(response, 500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error.',
        },
      });
    }
  };
}