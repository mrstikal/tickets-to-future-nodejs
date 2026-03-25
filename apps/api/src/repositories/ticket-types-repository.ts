import type { PostgresRuntime } from '../types/runtime';
import type { TicketType } from '../types/domain';

type TicketTypeRow = {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  image_asset_id: string;
  created_at: string;
  updated_at: string;
  local_image_path: string;
  total_quantity: number;
  sold_quantity: number;
};

function mapTicketTypeRow(row: TicketTypeRow): TicketType {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isActive: row.is_active,
    imageAssetId: row.image_asset_id,
    imageUrl: row.local_image_path,
    totalQuantity: row.total_quantity,
    soldQuantity: row.sold_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketTypesRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async findAll(limit: number = 20, offset: number = 0): Promise<{ items: TicketType[]; total: number }> {
      // noinspection SqlResolve
      const countResult = await postgresRuntime.pool.query<{ count: string }>(
        'SELECT COUNT(*) FROM ticket_types'
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<TicketTypeRow>(
        `
          SELECT
            tt.*,
            ia.local_image_path,
            tt.total_quantity,
            tt.sold_quantity
          FROM ticket_types tt
          INNER JOIN image_assets ia ON ia.id = tt.image_asset_id
          ORDER BY tt.created_at DESC, tt.id ASC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      );

      const items = result.rows.map(mapTicketTypeRow);

      return { items, total };
    },

    async hasEvents(id: string): Promise<boolean> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query(
        'SELECT 1 FROM ticket_events WHERE ticket_type_id = $1 LIMIT 1',
        [id]
      );
      return result.rows.length > 0;
    },

    async findById(id: string): Promise<TicketType | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<TicketTypeRow>(
        `
          SELECT
            tt.*,
            ia.local_image_path,
            tt.total_quantity,
            tt.sold_quantity
          FROM ticket_types tt
          INNER JOIN image_assets ia ON ia.id = tt.image_asset_id
          WHERE tt.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapTicketTypeRow(result.rows[0]);
    },

    async create(data: {
      title: string;
      description: string;
      isActive: boolean;
      imageAssetId: string;
      totalQuantity: number;
      soldQuantity: number;
    }): Promise<TicketType> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<TicketTypeRow>(
        `
          INSERT INTO ticket_types
            (title, description, is_active, image_asset_id, total_quantity, sold_quantity)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          data.title,
          data.description,
          data.isActive,
          data.imageAssetId,
          data.totalQuantity,
          data.soldQuantity,
        ]
      );

      return mapTicketTypeRow(result.rows[0]);
    },

    async update(
      id: string,
      data: {
        title?: string;
        description?: string;
        isActive?: boolean;
        imageAssetId?: string;
        totalQuantity?: number;
        soldQuantity?: number;
      }
    ): Promise<TicketType | null> {
      const fields = [];
      const values = [];
      let idx = 1;

      if (data.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(data.isActive);
      }
      if (data.imageAssetId !== undefined) {
        fields.push(`image_asset_id = $${idx++}`);
        values.push(data.imageAssetId);
      }
      if (data.totalQuantity !== undefined) {
        fields.push(`total_quantity = $${idx++}`);
        values.push(data.totalQuantity);
      }
      if (data.soldQuantity !== undefined) {
        fields.push(`sold_quantity = $${idx++}`);
        values.push(data.soldQuantity);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);

      // noinspection SqlResolve
      const query = `
        UPDATE ticket_types tt
        SET ${fields.join(', ')}, updated_at = now()
        FROM image_assets ia
        WHERE tt.id = $${idx} AND ia.id = tt.image_asset_id
        RETURNING tt.*, ia.local_image_path
      `;

      const result = await postgresRuntime.pool.query<TicketTypeRow>(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return mapTicketTypeRow(result.rows[0]);
    },

    async delete(id: string): Promise<boolean> {
      // Check if ticket_events exist for this ticket_type
      // noinspection SqlResolve
      const checkResult = await postgresRuntime.pool.query(
        'SELECT 1 FROM ticket_events WHERE ticket_type_id = $1 LIMIT 1',
        [id]
      );

      if (checkResult.rows.length > 0) {
        throw new Error('Cannot delete ticket type with existing ticket events');
      }

      // noinspection SqlResolve
      const deleteResult = await postgresRuntime.pool.query(
        'DELETE FROM ticket_types WHERE id = $1',
        [id]
      );

      return (deleteResult.rowCount ?? 0) > 0;
    },

    async forceDelete(id: string): Promise<boolean> {
      const client = await postgresRuntime.pool.connect();
      try {
        await client.query('BEGIN');
        // Delete ticket_events for this ticket_type
        await client.query(
          'DELETE FROM ticket_events WHERE ticket_type_id = $1',
          [id]
        );
        // Delete the ticket_type itself
        const deleteResult = await client.query(
          'DELETE FROM ticket_types WHERE id = $1',
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
  };
}