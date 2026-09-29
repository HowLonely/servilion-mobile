import * as SQLite from 'expo-sqlite';

import type {
  CachedOrder,
  CachedRoom,
  DeliveryRecord,
  LinenCompanyBalance,
  LinenMovementRecord,
} from './types';

const RETENTION_DAYS = 30;
const databasePromise = SQLite.openDatabaseAsync('servilion-entregas.db');

export async function initializeDatabase(): Promise<void> {
  const database = await databasePromise;
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cached_orders (
      server_id INTEGER PRIMARY KEY NOT NULL,
      order_number TEXT,
      reference TEXT NOT NULL,
      control_code TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      delivery_flow TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_room_id INTEGER,
      room_number TEXT NOT NULL,
      camp_name TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cached_orders_codes
      ON cached_orders(order_number, reference, control_code);

    CREATE TABLE IF NOT EXISTS cached_rooms (
      id INTEGER PRIMARY KEY NOT NULL,
      camp_id INTEGER NOT NULL,
      camp_name TEXT NOT NULL,
      faena_id INTEGER NOT NULL,
      number TEXT NOT NULL,
      qr_code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      client_uuid TEXT PRIMARY KEY NOT NULL,
      order_server_id INTEGER NOT NULL,
      order_code TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      delivery_flow TEXT NOT NULL,
      room_qr TEXT,
      scanned_room_label TEXT,
      confirm_different_room INTEGER NOT NULL DEFAULT 0,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_meters REAL NOT NULL,
      delivered_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS deliveries_state_created
      ON deliveries(state, created_at);

    -- Cola de repartos y retiros de hotelería. Mismo criterio que las entregas:
    -- el client_uuid nace aquí y se reutiliza en cada reintento.
    CREATE TABLE IF NOT EXISTS linen_movements (
      client_uuid TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      camp_id INTEGER NOT NULL,
      camp_name TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_meters REAL NOT NULL,
      occurred_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS linen_movements_state_created
      ON linen_movements(state, created_at);

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  await purgeExpiredDeliveries();
}

export async function replaceCatalog(orders: CachedOrder[], rooms: CachedRoom[]): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM cached_orders WHERE status = ?', 'DESPACHADA');
    for (const order of orders) {
      await upsertOrder(order, database);
    }
    await database.runAsync('DELETE FROM cached_rooms');
    for (const room of rooms) {
      await database.runAsync(
        `INSERT INTO cached_rooms
          (id, camp_id, camp_name, faena_id, number, qr_code, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        room.id, room.camp_id, room.camp_name, room.faena_id, room.number,
        room.qr_code.toLowerCase(), room.is_active ? 1 : 0,
      );
    }
    await database.runAsync(
      `INSERT INTO metadata(key, value) VALUES ('last_catalog_sync', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      new Date().toISOString(),
    );
  });
}

export async function upsertCachedOrder(order: CachedOrder): Promise<void> {
  await upsertOrder(order, await databasePromise);
}

async function upsertOrder(order: CachedOrder, database: SQLite.SQLiteDatabase): Promise<void> {
  await database.runAsync(
    `INSERT INTO cached_orders
      (server_id, order_number, reference, control_code, worker_name, company_name,
       client_name, delivery_flow, status, delivery_room_id, room_number, camp_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(server_id) DO UPDATE SET
       order_number = excluded.order_number, reference = excluded.reference,
       control_code = excluded.control_code, worker_name = excluded.worker_name,
       company_name = excluded.company_name, client_name = excluded.client_name,
       delivery_flow = excluded.delivery_flow, status = excluded.status,
       delivery_room_id = excluded.delivery_room_id, room_number = excluded.room_number,
       camp_name = excluded.camp_name, updated_at = excluded.updated_at`,
    order.server_id, order.order_number, order.reference, order.control_code,
    order.worker_name, order.company_name, order.client_name, order.delivery_flow,
    order.status, order.delivery_room_id, order.room_number, order.camp_name, order.updated_at,
  );
}

export async function findCachedOrder(code: string): Promise<CachedOrder | null> {
  const normalized = code.trim();
  return (await databasePromise).getFirstAsync<CachedOrder>(
    `SELECT * FROM cached_orders
     WHERE order_number = ? COLLATE NOCASE
        OR reference = ? COLLATE NOCASE
        OR control_code = ? COLLATE NOCASE
     ORDER BY updated_at DESC LIMIT 1`,
    normalized, normalized, normalized,
  );
}

export async function findCachedRoom(qrCode: string): Promise<CachedRoom | null> {
  return (await databasePromise).getFirstAsync<CachedRoom>(
    'SELECT * FROM cached_rooms WHERE qr_code = ? LIMIT 1',
    qrCode.trim().toLowerCase(),
  );
}

export async function insertDelivery(delivery: DeliveryRecord): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO deliveries
        (client_uuid, order_server_id, order_code, worker_name, company_name,
         delivery_flow, room_qr, scanned_room_label, confirm_different_room,
         latitude, longitude, accuracy_meters, delivered_at, note, state,
         attempt_count, last_error, created_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      delivery.client_uuid, delivery.order_server_id, delivery.order_code,
      delivery.worker_name, delivery.company_name, delivery.delivery_flow,
      delivery.room_qr, delivery.scanned_room_label, delivery.confirm_different_room,
      delivery.latitude, delivery.longitude, delivery.accuracy_meters,
      delivery.delivered_at, delivery.note, delivery.state, delivery.attempt_count,
      delivery.last_error, delivery.created_at, delivery.synced_at,
    );
    await database.runAsync(
      "UPDATE cached_orders SET status = 'ENTREGADA' WHERE server_id = ?",
      delivery.order_server_id,
    );
  });
}

export async function listDeliveries(limit = 100): Promise<DeliveryRecord[]> {
  return (await databasePromise).getAllAsync<DeliveryRecord>(
    'SELECT * FROM deliveries ORDER BY delivered_at DESC LIMIT ?',
    limit,
  );
}

export async function listPendingDeliveries(): Promise<DeliveryRecord[]> {
  return (await databasePromise).getAllAsync<DeliveryRecord>(
    "SELECT * FROM deliveries WHERE state IN ('PENDING', 'FAILED') ORDER BY created_at ASC",
  );
}

export async function markDeliverySynced(clientUuid: string): Promise<void> {
  await (await databasePromise).runAsync(
    "UPDATE deliveries SET state = 'SYNCED', synced_at = ?, last_error = NULL WHERE client_uuid = ?",
    new Date().toISOString(), clientUuid,
  );
}

export async function markDeliveryFailed(clientUuid: string, error: string): Promise<void> {
  await (await databasePromise).runAsync(
    `UPDATE deliveries SET state = 'FAILED', attempt_count = attempt_count + 1,
     last_error = ? WHERE client_uuid = ?`,
    error.slice(0, 500), clientUuid,
  );
}

/** Entregas y movimientos de hotelería que todavía no llegan al servidor. */
export async function getPendingCount(): Promise<number> {
  const row = await (await databasePromise).getFirstAsync<{ count: number }>(
    `SELECT
       (SELECT COUNT(*) FROM deliveries WHERE state IN ('PENDING', 'FAILED')) +
       (SELECT COUNT(*) FROM linen_movements WHERE state IN ('PENDING', 'FAILED')) AS count`,
  );
  return row?.count ?? 0;
}

export async function getLastCatalogSync(): Promise<string | null> {
  const row = await (await databasePromise).getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'last_catalog_sync'",
  );
  return row?.value ?? null;
}

export async function purgeExpiredDeliveries(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await (await databasePromise).runAsync(
    "DELETE FROM deliveries WHERE state = 'SYNCED' AND synced_at < ?",
    cutoff,
  );
  // Los rechazados también se purgan: ya los vio el supervisor en el
  // historial y no hay nada que reintentar.
  await (await databasePromise).runAsync(
    "DELETE FROM linen_movements WHERE state IN ('SYNCED', 'REJECTED') AND COALESCE(synced_at, created_at) < ?",
    cutoff,
  );
}

// --- Hotelería ---------------------------------------------------------------

const LINEN_BALANCES_KEY = 'linen_balances';
const LINEN_BALANCES_AT_KEY = 'linen_balances_at';

/**
 * Guarda el saldo de hotelería descargado. Se guarda entero como JSON y no en
 * tablas: son un puñado de clientes y campamentos, y siempre se lee completo.
 */
export async function replaceLinenBalances(balances: LinenCompanyBalance[]): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    for (const [key, value] of [
      [LINEN_BALANCES_KEY, JSON.stringify(balances)],
      [LINEN_BALANCES_AT_KEY, new Date().toISOString()],
    ]) {
      await database.runAsync(
        `INSERT INTO metadata(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key, value,
      );
    }
  });
}

export async function getLinenBalances(): Promise<{
  balances: LinenCompanyBalance[];
  snapshotAt: string | null;
}> {
  const database = await databasePromise;
  const [stored, at] = await Promise.all([
    database.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', LINEN_BALANCES_KEY),
    database.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', LINEN_BALANCES_AT_KEY),
  ]);
  let balances: LinenCompanyBalance[] = [];
  try {
    balances = stored ? JSON.parse(stored.value) as LinenCompanyBalance[] : [];
  } catch {
    balances = [];
  }
  return { balances, snapshotAt: at?.value ?? null };
}

export async function insertLinenMovement(movement: LinenMovementRecord): Promise<void> {
  await (await databasePromise).runAsync(
    `INSERT INTO linen_movements
      (client_uuid, kind, company_id, company_name, camp_id, camp_name, lines_json,
       total_quantity, latitude, longitude, accuracy_meters, occurred_at, note, state,
       attempt_count, last_error, created_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    movement.client_uuid, movement.kind, movement.company_id, movement.company_name,
    movement.camp_id, movement.camp_name, movement.lines_json, movement.total_quantity,
    movement.latitude, movement.longitude, movement.accuracy_meters, movement.occurred_at,
    movement.note, movement.state, movement.attempt_count, movement.last_error,
    movement.created_at, movement.synced_at,
  );
}

export async function listLinenMovements(limit = 100): Promise<LinenMovementRecord[]> {
  return (await databasePromise).getAllAsync<LinenMovementRecord>(
    'SELECT * FROM linen_movements ORDER BY occurred_at DESC LIMIT ?',
    limit,
  );
}

export async function getLinenMovement(clientUuid: string): Promise<LinenMovementRecord | null> {
  return (await databasePromise).getFirstAsync<LinenMovementRecord>(
    'SELECT * FROM linen_movements WHERE client_uuid = ?',
    clientUuid,
  );
}

export async function listPendingLinenMovements(): Promise<LinenMovementRecord[]> {
  return (await databasePromise).getAllAsync<LinenMovementRecord>(
    "SELECT * FROM linen_movements WHERE state IN ('PENDING', 'FAILED') ORDER BY created_at ASC",
  );
}

export async function markLinenMovementSynced(clientUuid: string): Promise<void> {
  await (await databasePromise).runAsync(
    "UPDATE linen_movements SET state = 'SYNCED', synced_at = ?, last_error = NULL WHERE client_uuid = ?",
    new Date().toISOString(), clientUuid,
  );
}

export async function markLinenMovementFailed(clientUuid: string, error: string): Promise<void> {
  await (await databasePromise).runAsync(
    `UPDATE linen_movements SET state = 'FAILED', attempt_count = attempt_count + 1,
     last_error = ? WHERE client_uuid = ?`,
    error.slice(0, 500), clientUuid,
  );
}

/** El servidor lo rechazó por una regla del negocio: no se vuelve a enviar. */
export async function markLinenMovementRejected(clientUuid: string, error: string): Promise<void> {
  await (await databasePromise).runAsync(
    `UPDATE linen_movements SET state = 'REJECTED', attempt_count = attempt_count + 1,
     last_error = ?, synced_at = ? WHERE client_uuid = ?`,
    error.slice(0, 500), new Date().toISOString(), clientUuid,
  );
}