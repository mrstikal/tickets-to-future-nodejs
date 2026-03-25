import type { PostgresRuntime } from '../types/runtime';
import type { TicketEvent } from '../types/domain';

type TicketEventRow = {
  id: string;
  ticket_type_id: string;
  slug: string;
  title: string;
  description: string;
  event_at: string;
  price: number;
  currency: string;
  total_quantity: number;
  sold_quantity: number;
  is_active: boolean;
  image_asset_id: string;
  created_at: string;
  updated_at: string;
  local_image_path: string;
};

function mapTicketEventRow(row: TicketEventRow): TicketEvent {
  return {
    id: row.id,
    ticketTypeId: row.ticket_type_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    eventAt: row.event_at,
    price: row.price,
    currency: row.currency,
    totalQuantity: row.total_quantity,
    soldQuantity: row.sold_quantity,
    isActive: row.is_active,
    imageAssetId: row.image_asset_id,
    imageUrl: row.local_image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketEventsRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async findAll(
      limit: number = 20,
      offset: number = 0,
      ticketTypeId?: string
    ): Promise<{ items: TicketEvent[]; total: number }> {
      let countQuery = 'SELECT COUNT(*) FROM ticket_events';
      let countParams: string[] = [];
      if (ticketTypeId) {
        countQuery += ' WHERE ticket_type_id = $1';
        countParams = [ticketTypeId];
      }

      const countResult = await postgresRuntime.pool.query<{ count: string }>(
        countQuery,
        countParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      let query = `
        SELECT
          te.*,
          ia.local_image_path
        FROM ticket_events te
        INNER JOIN image_assets ia ON ia.id = te.image_asset_id
      `;
      const queryParams: string[] = [];
      let paramIdx = 1;

      if (ticketTypeId) {
        query += ` WHERE te.ticket_type_id = $${paramIdx++}`;
        queryParams.push(ticketTypeId);
      }

      query += ` ORDER BY te.event_at DESC, te.created_at DESC, te.id ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      queryParams.push(String(limit), String(offset));

      const result = await postgresRuntime.pool.query<TicketEventRow>(
        query,
        queryParams
      );

      const items = result.rows.map(mapTicketEventRow);

      return { items, total };
    },

    async findById(id: string): Promise<TicketEvent | null> {
      const result = await postgresRuntime.pool.query<TicketEventRow>(
        `
          SELECT
            te.*,
            ia.local_image_path
          FROM ticket_events te
          INNER JOIN image_assets ia ON ia.id = te.image_asset_id
          WHERE te.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapTicketEventRow(result.rows[0]);
    },

    async create(data: {
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
      imageAssetId: string;
    }): Promise<TicketEvent> {
      const result = await postgresRuntime.pool.query<TicketEventRow>(
        `
          INSERT INTO ticket_events (
            ticket_type_id,
            slug,
            title,
            description,
            event_at,
            price,
            currency,
            total_quantity,
            sold_quantity,
            is_active,
            image_asset_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `,
        [
          data.ticketTypeId,
          data.slug,
          data.title,
          data.description,
          data.eventAt,
          data.price,
          data.currency,
          data.totalQuantity,
          data.soldQuantity,
          data.isActive,
          data.imageAssetId,
        ]
      );

      // Need to fetch with image_assets join to get local_image_path
      const created = await this.findById(result.rows[0].id);
      if (!created) {
        throw new Error('Failed to fetch created ticket event');
      }
      return created;
    },

    async update(
      id: string,
      data: {
        ticketTypeId?: string;
        slug?: string;
        title?: string;
        description?: string;
        eventAt?: string;
        price?: number;
        currency?: string;
        totalQuantity?: number;
        soldQuantity?: number;
        isActive?: boolean;
        imageAssetId?: string;
      }
    ): Promise<TicketEvent | null> {
      const fields: string[] = [];
      const values: (string | number | boolean)[] = [];
      let idx = 1;

      if (data.ticketTypeId !== undefined) {
        fields.push(`ticket_type_id = $${idx++}`);
        values.push(data.ticketTypeId);
      }
      if (data.slug !== undefined) {
        fields.push(`slug = $${idx++}`);
        values.push(data.slug);
      }
      if (data.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.eventAt !== undefined) {
        fields.push(`event_at = $${idx++}`);
        values.push(data.eventAt);
      }
      if (data.price !== undefined) {
        fields.push(`price = $${idx++}`);
        values.push(data.price);
      }
      if (data.currency !== undefined) {
        fields.push(`currency = $${idx++}`);
        values.push(data.currency);
      }
      if (data.totalQuantity !== undefined) {
        fields.push(`total_quantity = $${idx++}`);
        values.push(data.totalQuantity);
      }
      if (data.soldQuantity !== undefined) {
        fields.push(`sold_quantity = $${idx++}`);
        values.push(data.soldQuantity);
      }
      if (data.isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(data.isActive);
      }
      if (data.imageAssetId !== undefined) {
        fields.push(`image_asset_id = $${idx++}`);
        values.push(data.imageAssetId);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);

      const query = `
        UPDATE ticket_events te
        SET ${fields.join(', ')}, updated_at = now()
        FROM image_assets ia
        WHERE te.id = $${idx} AND ia.id = te.image_asset_id
        RETURNING te.*, ia.local_image_path
      `;

      const result = await postgresRuntime.pool.query<TicketEventRow>(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return mapTicketEventRow(result.rows[0]);
    },

    async delete(id: string): Promise<boolean> {
      // Check if holds or orders exist for this ticket event
      const hasDeps = await this.hasHoldsOrOrders(id);
      if (hasDeps) {
        throw new Error('Cannot delete ticket event with existing holds or orders');
      }

      const deleteResult = await postgresRuntime.pool.query(
        'DELETE FROM ticket_events WHERE id = $1',
        [id]
      );

      return (deleteResult.rowCount ?? 0) > 0;
    },

    async forceDelete(id: string): Promise<boolean> {
      const client = await postgresRuntime.pool.connect();
      try {
        await client.query('BEGIN');
        // Delete holds for this ticket event
        await client.query(
          'DELETE FROM ticket_holds WHERE ticket_id = $1',
          [id]
        );
        // Delete order items for this ticket event
        await client.query(
          'DELETE FROM order_items WHERE ticket_id = $1',
          [id]
        );
        // Delete the ticket event itself
        const deleteResult = await client.query(
          'DELETE FROM ticket_events WHERE id = $1',
          [id]
        );
        await client.query('COMMIT');
        return (deleteResult.rowCount ?? 0) > 0;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async hasHoldsOrOrders(id: string): Promise<boolean> {
      const holdsResult = await postgresRuntime.pool.query(
        'SELECT 1 FROM ticket_holds WHERE ticket_id = $1 LIMIT 1',
        [id]
      );
      if (holdsResult.rows.length > 0) {
        return true;
      }

      const ordersResult = await postgresRuntime.pool.query(
        'SELECT 1 FROM order_items WHERE ticket_id = $1 LIMIT 1',
        [id]
      );
      return ordersResult.rows.length > 0;
    },
  };
}