import * as Network from 'expo-network';

import { fetchDeliveryCatalog, sendDelivery } from './api';
import {
  listPendingDeliveries,
  markDeliveryFailed,
  markDeliverySynced,
  purgeExpiredDeliveries,
  replaceCatalog,
} from './database';
import type { DeliveryPayload, Session } from './types';

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