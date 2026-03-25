import { OpenAPIV3 } from 'openapi-types';

const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Tickets to Future - Admin API',
    version: '1.0.0',
    description: 'OpenAPI specification for the Admin Dashboard API endpoints',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      DashboardFilters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          ticketTypeId: { type: 'string' },
          ticketEventId: { type: 'string' },
        },
        additionalProperties: false,
      },
      AdminStatsOverview: {
        type: 'object',
        properties: {
          totalRevenue: { type: 'number' },
          orderCount: { type: 'integer' },
          avgOrderValue: { type: 'number' },
          ticketsSold: { type: 'integer' },
        },
        required: ['totalRevenue', 'orderCount', 'avgOrderValue', 'ticketsSold'],
      },
      AdminTopSellingResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ticketId: { type: 'string' },
                title: { type: 'string' },
                eventAt: { type: 'string', format: 'date-time' },
                sellThroughPercent: { type: 'number' },
                soldQuantity: { type: 'integer' },
                totalQuantity: { type: 'integer' },
                revenue: { type: 'number' },
                imageUrl: { type: 'string' },
              },
              required: ['ticketId', 'title', 'eventAt', 'sellThroughPercent', 'soldQuantity', 'totalQuantity', 'revenue', 'imageUrl'],
            },
          },
        },
        required: ['items'],
      },
      AdminLeastSellingResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ticketId: { type: 'string' },
                title: { type: 'string' },
                eventAt: { type: 'string', format: 'date-time' },
                sellThroughPercent: { type: 'number' },
                soldQuantity: { type: 'integer' },
                totalQuantity: { type: 'integer' },
                revenue: { type: 'number' },
                imageUrl: { type: 'string' },
              },
              required: ['ticketId', 'title', 'eventAt', 'sellThroughPercent', 'soldQuantity', 'totalQuantity', 'revenue', 'imageUrl'],
            },
          },
        },
        required: ['items'],
      },
      AdminTicketTypesResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
              required: ['id', 'title'],
            },
          },
        },
        required: ['items'],
      },
      AdminTicketEventsResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                eventAt: { type: 'string', format: 'date-time' },
              },
              required: ['id', 'title', 'eventAt'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/admin/stats/overview': {
      get: {
        summary: 'Get overview statistics',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'ticketTypeId',
            in: 'query',
            schema: { type: 'string' },
            required: false,
          },
          {
            name: 'ticketEventId',
            in: 'query',
            schema: { type: 'string' },
            required: false,
          },
        ],
        responses: {
          '200': {
            description: 'Overview statistics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminStatsOverview' },
              },
            },
          },
        },
      },
    },
    '/admin/stats/top-selling': {
      get: {
        summary: 'Get top selling tickets',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'ticketTypeId',
            in: 'query',
            schema: { type: 'string' },
            required: false,
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
            required: false,
          },
        ],
        responses: {
          '200': {
            description: 'Top selling tickets',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminTopSellingResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/stats/least-selling': {
      get: {
        summary: 'Get least selling tickets',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            required: false,
          },
          {
            name: 'ticketTypeId',
            in: 'query',
            schema: { type: 'string' },
            required: false,
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
            required: false,
          },
        ],
        responses: {
          '200': {
            description: 'Least selling tickets',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminLeastSellingResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/filters/ticket-types': {
      get: {
        summary: 'Get ticket types',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Ticket types',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminTicketTypesResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/filters/ticket-events': {
      get: {
        summary: 'Get ticket events',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'ticketTypeId',
            in: 'query',
            schema: { type: 'string' },
            required: false,
          },
        ],
        responses: {
          '200': {
            description: 'Ticket events',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminTicketEventsResponse' },
              },
            },
          },
        },
      },
    },
  },
};

export default openApiSpec;