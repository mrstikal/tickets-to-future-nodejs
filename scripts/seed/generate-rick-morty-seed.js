const fs = require('node:fs');
const path = require('node:path');

const TARGET_COUNT = 300;
const API_BASE = 'https://rickandmortyapi.com/api/character';
const WEB_ASSETS_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'apps',
  'web',
  'public',
  'assets',
  'characters'
);

const openers = [
  'Interdimensional Fast Track',
  'Portal Priority Access',
  'Council-Proof Entrance',
  'Meeseeks Assisted Pass',
  'Schwifty Queue Skip',
  'Plumbus Premium Lane',
  'Wubba-Lubba Front Row',
  'Quantum Sofa Upgrade',
  'Galactic Snack Bundle',
  'Time-Twist Boarding'
];

const closers = [
  'with no snakes on the dance floor',
  'minus one existential crisis (probably)',
  'and complimentary anti-time-paradox tape',
  'with extra battery for your portal gun',
  'featuring legally distinct background music',
  'with priority line-jump permission slip',
  'and one emergency pickle conversion voucher',
  'plus a tiny helmet for cosmic debris',
  'with multiverse-friendly customer support',
  'and a receipt acceptable in most timelines'
];

const descriptors = [
  'dramatic entrance',
  'chaos-managed meetup',
  'dimension-hopping afterparty',
  'reality-bending showcase',
  'cosmic networking hour',
  'timeline-safe crowd experience',
  'gravity-optional warm-up',
  'space-bar jazz session',
  'anti-cronenberg social event',
  'zero-g applause experiment'
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function seededNumber(seed, min, maxInclusive) {
  const span = maxInclusive - min + 1;
  const next = (seed * 9301 + 49297) % 233280;
  return min + (next % span);
}

async function fetchCharacters(limit) {
  const result = [];
  let nextUrl = API_BASE;

  while (nextUrl && result.length < limit) {
    const response = await fetch(nextUrl);

    if (!response.ok) {
      throw new Error(`Rick and Morty API request failed: ${response.status}`);
    }

    const payload = await response.json();

    for (const character of payload.results) {
      result.push({
        id: String(character.id),
        name: String(character.name),
        imageUrl: String(character.image),
      });

      if (result.length >= limit) {
        break;
      }
    }

    nextUrl = payload.info?.next || null;
  }

  return result.slice(0, limit);
}

function buildTicketRows(characters) {
  return characters.map((character, index) => {
    const numericId = Number(character.id);
    const opener = openers[index % openers.length];
    const closer = closers[(index * 3) % closers.length];
    const descriptor = descriptors[(index * 7) % descriptors.length];

    const title = `${opener}: ${character.name} #${character.id}`;
    const description = `${character.name} hosts a ${descriptor}; ${closer}. Ticket #${character.id} is strictly non-refundable across dimensions.`;

    const price = seededNumber(numericId, 490, 2690);
    const totalQuantity = seededNumber(numericId * 17, 10, 60);
    const soldBase = seededNumber(numericId * 31, 0, 80) / 100;
    const soldQuantity = Math.min(totalQuantity, Math.floor(totalQuantity * soldBase));
    const isActive = numericId % 13 !== 0;

    const slugBase = slugify(character.name) || `character-${character.id}`;
    const slug = `rm-${character.id}-${slugBase}`.slice(0, 120);
    const localImagePath = `/assets/characters/${character.id}-${slugBase}.jpg`;

    return {
      externalId: character.id,
      name: character.name,
      imageUrl: character.imageUrl,
      localImagePath,
      slug,
      title,
      description,
      price,
      totalQuantity,
      soldQuantity,
      isActive,
    };
  });
}

async function downloadImages(rows, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const failed = [];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function downloadWithRetry(url, maxAttempts = 6) {
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;

      const response = await fetch(url);

      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }

      if (response.status !== 429 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : 0;
      const backoffMs = retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : attempt * 600;

      await sleep(backoffMs);
    }

    throw new Error('HTTP 429/5xx after retries');
  }

  for (const row of rows) {
    const fileName = path.basename(row.localImagePath);
    const filePath = path.join(targetDir, fileName);

    if (fs.existsSync(filePath)) {
      continue;
    }

    try {
      const data = await downloadWithRetry(row.imageUrl);
      fs.writeFileSync(filePath, data);
      await sleep(120);
    } catch (error) {
      failed.push({ id: row.externalId, imageUrl: row.imageUrl, error });
    }
  }

  if (failed.length > 0) {
    const details = failed
      .slice(0, 5)
      .map((item) => `${item.id}: ${String(item.error)}`)
      .join('; ');

    throw new Error(
      `Failed to download ${failed.length} images. Examples: ${details}`
    );
  }
}

function validateRows(rows) {
  const uniqueBy = (items) => new Set(items).size === items.length;

  if (rows.length !== TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} rows, got ${rows.length}`);
  }

  if (!uniqueBy(rows.map((row) => row.externalId))) {
    throw new Error('external_id contains duplicates.');
  }

  if (!uniqueBy(rows.map((row) => row.slug))) {
    throw new Error('slug contains duplicates.');
  }

  if (!uniqueBy(rows.map((row) => row.title))) {
    throw new Error('title contains duplicates.');
  }

  if (!uniqueBy(rows.map((row) => row.description))) {
    throw new Error('description contains duplicates.');
  }

  for (const row of rows) {
    if (row.soldQuantity > row.totalQuantity) {
      throw new Error(
        `sold_quantity > total_quantity for external_id=${row.externalId}`
      );
    }
  }
}

function buildSql(rows) {
  const valuesSql = rows
    .map((row) => {
      return `    ('${sqlEscape(row.externalId)}', '${sqlEscape(row.name)}', '${sqlEscape(row.imageUrl)}', '${sqlEscape(row.localImagePath)}', '${sqlEscape(row.slug)}', '${sqlEscape(row.title)}', '${sqlEscape(row.description)}', ${row.price}, 'CZK', ${row.totalQuantity}, ${row.soldQuantity}, ${row.isActive ? 'true' : 'false'})`;
    })
    .join(',\n');

  return `-- Generated by scripts/seed/generate-rick-morty-seed.js on ${new Date().toISOString()}\n-- Source: https://rickandmortyapi.com/api/character\n\nwith characters_source (\n    external_id,\n    name,\n    image_url,\n    local_image_path,\n    slug,\n    title,\n    description,\n    price,\n    currency,\n    total_quantity,\n    sold_quantity,\n    is_active\n) as (\nvalues\n${valuesSql}\n)\ninsert into image_assets (\n    external_id,\n    name,\n    image_url,\n    local_image_path,\n    source\n)\nselect\n    cs.external_id,\n    cs.name,\n    cs.image_url,\n    cs.local_image_path,\n    'rick-and-morty-api'\nfrom characters_source cs\non conflict (external_id) do update\n    set\n        name = excluded.name,\n        image_url = excluded.image_url,\n        local_image_path = excluded.local_image_path,\n        source = excluded.source,\n        updated_at = now();\n\nwith characters_source (\n    external_id,\n    name,\n    image_url,\n    local_image_path,\n    slug,\n    title,\n    description,\n    price,\n    currency,\n    total_quantity,\n    sold_quantity,\n    is_active\n) as (\nvalues\n${valuesSql}\n)\ninsert into ticket_types (\n    title,\n    description,\n    currency,\n    total_quantity,\n    sold_quantity,\n    is_active,\n    image_asset_id\n)\nselect\n    cs.title,\n    cs.description,\n    cs.currency,\n    cs.total_quantity,\n    cs.sold_quantity,\n    cs.is_active,\n    ia.id\nfrom characters_source cs\njoin image_assets ia on ia.external_id = cs.external_id\non conflict do nothing;\n\nwith characters_source (\n    external_id,\n    name,\n    image_url,\n    local_image_path,\n    slug,\n    title,\n    description,\n    price,\n    currency,\n    total_quantity,\n    sold_quantity,\n    is_active\n) as (\nvalues\n${valuesSql}\n),\nticket_types as (\n    select\n        t.id as ticket_type_id,\n        t.title as type_title,\n        t.description as type_description,\n        cs.slug as type_slug,\n        cs.price as base_price,\n        t.currency,\n        t.is_active,\n        t.image_asset_id\n    from ticket_types t\n    join image_assets ia on ia.id = t.image_asset_id\n    join characters_source cs on cs.external_id = ia.external_id\n),\nexpanded as (\n    select\n        tt.*,\n        gs.instance_no,\n        (\n            timestamptz '2100-01-01 00:00:00+00'\n            + make_interval(\n                days => (abs(hashtext(tt.type_slug || '-day-' || gs.instance_no::text)) % 36525),\n                mins => (abs(hashtext(tt.type_slug || '-min-' || gs.instance_no::text)) % 1440)\n            )\n        ) as event_at\n    from ticket_types tt\n    cross join lateral generate_series(\n        1,\n        2 + (abs(hashtext(tt.type_slug || '-instances')) % 4)\n    ) as gs(instance_no)\n),\nprepared as (\n    select\n        concat(\n            ex.type_slug,\n            '-event-',\n            to_char(ex.event_at at time zone 'UTC', 'YYYYMMDDHH24MI'),\n            '-',\n            ex.instance_no\n        ) as slug,\n        concat(ex.type_title, ' Live #', ex.instance_no) as title,\n        concat(\n            ex.type_description,\n            ' Doors open at ',\n            to_char(ex.event_at at time zone 'UTC', 'FMMonth DD, YYYY "at" HH24:MI "UTC"'),\n            '.'\n        ) as description,\n        greatest(\n            290,\n            ex.base_price\n            + ((abs(hashtext(ex.type_slug || '-price-' || ex.instance_no::text)) % 701) - 250)\n        )::integer as price,\n        ex.currency,\n        (20 + (abs(hashtext(ex.type_slug || '-qty-' || ex.instance_no::text)) % 81))::integer as total_quantity,\n        ex.is_active,\n        ex.image_asset_id,\n        ex.ticket_type_id,\n        ex.event_at\n    from expanded ex\n)\ninsert into ticket_events (\n    ticket_type_id,\n    slug,\n    title,\n    description,\n    event_at,\n    price,\n    currency,\n    total_quantity,\n    sold_quantity,\n    is_active,\n    image_asset_id\n)\nselect\n    p.ticket_type_id,\n    p.slug,\n    p.title,\n    p.description,\n    p.event_at,\n    p.price,\n    p.currency,\n    p.total_quantity,\n    (abs(hashtext(p.slug || '-sold')) % (p.total_quantity + 1))::integer as sold_quantity,\n    p.is_active,\n    p.image_asset_id\nfrom prepared p\non conflict (slug) do update\n    set\n        ticket_type_id = excluded.ticket_type_id,\n        title = excluded.title,\n        description = excluded.description,\n        event_at = excluded.event_at,\n        price = excluded.price,\n        currency = excluded.currency,\n        total_quantity = excluded.total_quantity,\n        sold_quantity = excluded.sold_quantity,\n        is_active = excluded.is_active,\n        image_asset_id = excluded.image_asset_id,\n        updated_at = now();\n`;
}

async function main() {
  const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '..', '..', 'infra', 'sql', '002_seed_demo_data.sql');

  const characters = await fetchCharacters(TARGET_COUNT);

  if (characters.length < TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} characters, got ${characters.length}`);
  }

  const rows = buildTicketRows(characters);
  validateRows(rows);
  const sql = buildSql(rows);

  fs.writeFileSync(outputPath, sql, 'utf8');
  await downloadImages(rows, WEB_ASSETS_DIR);

  console.log(`Generated ${rows.length} records into ${outputPath}`);
  console.log(`Images are available in ${WEB_ASSETS_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

