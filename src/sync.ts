import * as Network from 'expo-network';

import { fetchDeliveryCatalog, fetchLinenBalances, sendDelivery, sendLinenMovements } from './api';
import {
  listPendingDeliveries,
  listPendingLinenMovements,
  markDeliveryFailed,
  markDeliverySynced,
  markLinenMovementFailed,
  markLinenMovementRejected,
  markLinenMovementSynced,
  purgeExpiredDeliveries,
  replaceCatalog,
  replaceLinenBalances,
} from './database';
import { parseLines } from './linen';
import type { DeliveryPayload, LinenMovementPayload, Session } from './types';

// Cuántos movimientos de lencería viajan por petición. Un turno sin señal
// junta decenas, no miles; el tope evita una sola petición gigante si alguna
// vez se acumulan.
const LINEN_BATCH_SIZE = 50;

export type SyncSummary = { sent: number; failed: number; session: Session };

export async function isOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function refreshCatalog(session: Session): Promise<Session> {
  const catalog = await fetchDeliveryCatalog(session);
  await replaceCatalog(catalog.orders, catalog.rooms);
  return catalog.session;
}

export async function syncPendingDeliveries(session: Session): Promise<SyncSummary> {
  if (!(await isOnline())) return { sent: 0, failed: 0, session };

  let activeSession = session;
  let sent = 0;
  let failed = 0;
  const pending = await listPendingDeliveries();

  for (const delivery of pending) {
    const payload: DeliveryPayload = {
      client_uuid: delivery.client_uuid,
      order_code: delivery.order_code,
      latitude: delivery.latitude,
      longitude: delivery.longitude,
      accuracy_meters: delivery.accuracy_meters,
      delivered_at: delivery.delivered_at,
      note: delivery.note,
      confirm_different_room: delivery.confirm_different_room === 1,
      ...(delivery.room_qr ? { room_qr: delivery.room_qr } : {}),
    };
    try {
      const result = await sendDelivery(activeSession, payload);
      activeSession = result.session;
      await markDeliverySynced(delivery.client_uuid);
      sent += 1;
    } catch (error) {
      await markDeliveryFailed(
        delivery.client_uuid,
        error instanceof Error ? error.message : 'No se pudo sincronizar la entrega.',
      );
      failed += 1;
    }
  }

  await purgeExpiredDeliveries();
  return { sent, failed, session: activeSession };
}
/** Baja el saldo de lencería para ver el de cada campamento sin señal. */
export async function refreshLinenBalances(session: Session): Promise<Session> {
  const result = await fetchLinenBalances(session);
  await replaceLinenBalances(result.data);
  return result.session;
}

export type LinenSyncSummary = SyncSummary & { rejected: number };

/**
 * Envía la cola de repartos y retiros de lencería.
 *
 * Si la petición entera falla (red, servidor caído) los movimientos quedan
 * FAILED y se reintentan en la próxima sincronización. Si el servidor responde
 * ERROR para uno, es un rechazo del negocio y queda REJECTED: reenviarlo no lo
 * va a arreglar y el supervisor lo ve en el historial.
 */
export async function syncPendingLinenMovements(session: Session): Promise<LinenSyncSummary> {
  if (!(await isOnline())) return { sent: 0, failed: 0, rejected: 0, session };

  let activeSession = session;
  let sent = 0;
  let failed = 0;
  let rejected = 0;
  const pending = await listPendingLinenMovements();

  for (let start = 0; start < pending.length; start += LINEN_BATCH_SIZE) {
    const batch = pending.slice(start, start + LINEN_BATCH_SIZE);
    const payloads: LinenMovementPayload[] = batch.map((movement) => ({
      client_uuid: movement.client_uuid,
      kind: movement.kind,
      company_id: movement.company_id,
      camp_id: movement.camp_id,
      lines: parseLines(movement.lines_json).map(({ garment_type_id, quantity }) => ({ garment_type_id, quantity })),
      occurred_at: movement.occurred_at,
      latitude: movement.latitude,
      longitude: movement.longitude,
      accuracy_meters: movement.accuracy_meters,
      note: movement.note,
    }));

    try {
      const result = await sendLinenMovements(activeSession, payloads);
      activeSession = result.session;
      for (const outcome of result.data.results) {
        if (outcome.status === 'ERROR') {
          await markLinenMovementRejected(outcome.client_uuid, outcome.detail || 'El servidor rechazó el movimiento.');
          rejected += 1;
        } else {
          await markLinenMovementSynced(outcome.client_uuid);
          sent += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo sincronizar la lencería.';
      for (const movement of batch) await markLinenMovementFailed(movement.client_uuid, message);
      failed += batch.length;
      // Si falló una petición entera, las siguientes van a fallar igual.
      break;
    }
  }

  return { sent, failed, rejected, session: activeSession };
}
