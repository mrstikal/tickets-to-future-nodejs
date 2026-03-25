import type { PostgresRuntime } from '../types/runtime';

type ImageAssetRow = {
  id: string;
  external_id: string;
  name: string;
  image_url: string;
  local_image_path: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export function createImageAssetsRepository(postgresRuntime: PostgresRuntime | null = null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async create(data: {
      id: string;
      externalId: string;
      name: string;
      imageUrl: string;
      localImagePath: string;
      source: string;
    }): Promise<ImageAssetRow> {
      const result = await postgresRuntime.pool.query<ImageAssetRow>(
        `
          INSERT INTO image_assets
            (id, external_id, name, image_url, local_image_path, source)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          data.id,
          data.externalId,
          data.name,
          data.imageUrl,
          data.localImagePath,
          data.source,
        ]
      );

      return result.rows[0];
    },
  };
}