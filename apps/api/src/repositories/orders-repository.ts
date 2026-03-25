import type { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import type { Order, OrderItem, OrderStatus, AdminOrder } from '../types/domain';
import type { PostgresRuntime } from '../types/runtime';

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  name?: string;
  reference_number?: string;
  status: OrderStatus;
  total_price: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  ticket_id: string;
  ticket_title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type AdminOrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  email: string;
  name?: string;
  reference_number?: string;
  total_price: number;
  currency: string;
  created_at: string;
  updated_at: string;
  item_count: string;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

type Queryable = Pool | PoolClient;

function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    ticketId: row.ticket_id,
    ticketTitle: row.ticket_title,
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    totalPrice: toNumber(row.total_price),
  };
}

function mapOrderRow(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    email: row.email,
    name: row.name,
    referenceNumber: row.reference_number,
    currency: row.currency,
    totalPrice: toNumber(row.total_price),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAdminOrderRow(row: AdminOrderRow): AdminOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    email: row.email,
    name: row.name ?? undefined,
    referenceNumber: row.reference_number ?? undefined,
    currency: row.currency,
    totalPrice: toNumber(row.total_price),
    itemCount: parseInt(row.item_count, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrdersRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async createOrder(
      params: {
        email: string;
        name: string;
        referenceNumber?: string | null;
        status: string;
        totalPrice: number;
        currency: string;
        discountPercentage?: number;
      },
      client: Queryable = postgresRuntime.pool
    ): Promise<OrderRow> {
      const orderNumber = `ORD-${crypto.randomUUID()}`;

       // noinspection SqlResolve
      const result = await client.query<OrderRow>(
        `
          insert into orders (
            order_number,
            email,
            name,
            reference_number,
            status,
            total_price,
            currency
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning
            id,
            order_number,
            email,
            name,
            reference_number,
            status,
            total_price,
            currency,
            created_at,
            updated_at
        `,
        [
          orderNumber,
          params.email,
          params.name,
          params.referenceNumber,
          params.status,
          params.totalPrice,
          params.currency,
        ]
      );

      return result.rows[0];
    },

    async createOrderItem(
      params: {
        orderId: string;
        ticketId: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      },
      client: Queryable = postgresRuntime.pool
    ): Promise<void> {
      // noinspection SqlResolve
      await client.query(
        `
          insert into order_items (
            order_id,
            ticket_id,
            quantity,
            unit_price,
            total_price
          )
          values ($1, $2, $3, $4, $5)
        `,
        [
          params.orderId,
          params.ticketId,
          params.quantity,
          params.unitPrice,
          params.totalPrice,
        ]
      );
    },

    async findById(orderId: string): Promise<Order | null> {
      // noinspection SqlResolve
      const orderResult = await postgresRuntime.pool.query<OrderRow>(
        `
          select
            id,
            order_number,
            email,
            name,
            reference_number,
            status,
            total_price,
            currency,
            created_at,
            updated_at
          from orders
          where id = $1
        `,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return null;
      }

      // noinspection SqlResolve
      const itemsResult = await postgresRuntime.pool.query<OrderItemRow>(
        `
          select
            oi.ticket_id,
            te.title as ticket_title,
            sum(oi.quantity) as quantity,
            oi.unit_price,
            sum(oi.total_price) as total_price
          from order_items oi
          inner join ticket_events te on te.id = oi.ticket_id
          where oi.order_id = $1
          group by oi.ticket_id, te.title, oi.unit_price
          order by te.title asc
        `,
        [orderId]
      );

      return mapOrderRow(
        orderResult.rows[0],
        itemsResult.rows.map(mapOrderItemRow)
      );
    },

    async findAll(params: {
      limit: number;
      offset: number;
      status?: OrderStatus;
      startDate?: string;
      endDate?: string;
      email?: string;
    }): Promise<AdminOrder[]> {
      let query = `
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.email,
          o.name,
          o.reference_number,
          o.total_price,
          o.currency,
          o.created_at,
          o.updated_at,
          COUNT(oi.id)::text AS item_count
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
      `;

      const conditions: string[] = [];
      const values: (string | number)[] = [];
      let paramIdx = 1;

      if (params.status) {
        conditions.push(`o.status = $${paramIdx++}`);
        values.push(params.status);
      }

      if (params.startDate) {
        conditions.push(`o.created_at >= $${paramIdx++}`);
        values.push(params.startDate);
      }

      if (params.endDate) {
        conditions.push(`o.created_at <= $${paramIdx++}`);
        values.push(params.endDate);
      }

      if (params.email) {
        conditions.push(`o.email ILIKE $${paramIdx++}`);
        values.push(`%${params.email}%`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` GROUP BY o.id, o.order_number, o.status, o.email, o.name, o.reference_number, o.total_price, o.currency, o.created_at, o.updated_at`;
      query += ` ORDER BY o.created_at DESC, o.id ASC`;
      query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      values.push(params.limit, params.offset);

      const result = await postgresRuntime.pool.query<AdminOrderRow>(query, values);
      return result.rows.map(mapAdminOrderRow);
    },

    async countAll(params: {
      status?: OrderStatus;
      startDate?: string;
      endDate?: string;
      email?: string;
    }): Promise<number> {
      let query = `SELECT COUNT(*) FROM orders o`;
      const conditions: string[] = [];
      const values: (string | number)[] = [];
      let paramIdx = 1;

      if (params.status) {
        conditions.push(`o.status = $${paramIdx++}`);
        values.push(params.status);
      }

      if (params.startDate) {
        conditions.push(`o.created_at >= $${paramIdx++}`);
        values.push(params.startDate);
      }

      if (params.endDate) {
        conditions.push(`o.created_at <= $${paramIdx++}`);
        values.push(params.endDate);
      }

      if (params.email) {
        conditions.push(`o.email ILIKE $${paramIdx++}`);
        values.push(`%${params.email}%`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await postgresRuntime.pool.query<{ count: string }>(query, values);
      return parseInt(result.rows[0].count, 10);
    },

    async cancelOrder(id: string): Promise<boolean> {
      const result = await postgresRuntime.pool.query(
        `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`,
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    },

    async updateTotalPrice(id: string, totalPrice: number): Promise<boolean> {
      const result = await postgresRuntime.pool.query(
        `UPDATE orders SET total_price = $1, updated_at = now() WHERE id = $2`,
        [totalPrice, id]
      );
      return (result.rowCount ?? 0) > 0;
    },

    mapOrderRow,
  };
}