import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { AlertTriangle, Building2, CheckCircle2, LocateFixed, MapPin, PackageCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchOrderByCode } from '../api';
import { QrScanner } from '../components/QrScanner';
import { Button } from '../components/ui';
import { findCachedOrder, findCachedRoom, insertDelivery, upsertCachedOrder } from '../database';
import { isOnline, syncPendingDeliveries } from '../sync';
import { colors, fonts } from '../theme';
import type { CachedOrder, CachedRoom, DeliveryRecord, Session } from '../types';

type Stage = 'ORDER_SCAN' | 'ROOM_SCAN' | 'REVIEW' | 'LOCATING' | 'DONE';
type Props = {
  session: Session;
  online: boolean;
  onSessionChange: (session: Session) => void;
  onClose: () => void;
  onSaved: () => void;
};

export function DeliveryScreen({ session, online, onSessionChange, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('ORDER_SCAN');
  const [order, setOrder] = useState<CachedOrder | null>(null);
  const [room, setRoom] = useState<CachedRoom | null>(null);
  const [error, setError] = useState('');
  const [synced, setSynced] = useState(false);

  const scanOrder = async (code: string) => {
    setError('');
    try {
      let found = await findCachedOrder(code);
      if (!found && online) {
        const result = await fetchOrderByCode(session, code);
        onSessionChange(result.session);
        found = result.data;
        await upsertCachedOrder(found);
      }
      if (!found) throw new Error('Este morral no está en el catálogo offline. Sincroniza antes de salir a ruta.');
      if (found.status !== 'DESPACHADA') throw new Error(`La guía está ${found.status}; sólo se entregan morrales despachados.`);
      setOrder(found);
      setStage(found.delivery_flow === 'FLUJO_1' ? 'ROOM_SCAN' : 'REVIEW');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo identificar el morral.');
      setStage('ORDER_SCAN');
    }
  };

  const scanRoom = async (qrCode: string) => {
    const found = await findCachedRoom(qrCode);
    if (!found) {
      setError('El QR no corresponde a una habitación descargada. Sincroniza el catálogo e inténtalo otra vez.');
      setStage('ROOM_SCAN');
      return;
    }
    setRoom(found);
    setError('');
    setStage('REVIEW');
  };

  const save = async () => {
    if (!order) return;
    setStage('LOCATING');
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('La ubicación precisa es obligatoria para registrar la entrega.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Activa la ubicación del teléfono para continuar.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!position.coords.accuracy || position.coords.accuracy <= 0) {
        throw new Error('No fue posible obtener la precisión de la ubicación. Inténtalo nuevamente.');
      }

      const mismatched = order.delivery_flow === 'FLUJO_1' && order.delivery_room_id !== room?.id;
      const now = new Date().toISOString();
      const delivery: DeliveryRecord = {
        client_uuid: randomUUID(),
        order_server_id: order.server_id,
        order_code: order.order_number || order.reference || order.control_code,
        worker_name: order.worker_name,
        company_name: order.company_name,
        delivery_flow: order.delivery_flow,
        room_qr: room?.qr_code ?? null,
        scanned_room_label: room ? `${room.camp_name} · ${room.number}` : null,
        confirm_different_room: mismatched ? 1 : 0,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
        delivered_at: now,
        note: '',
        state: 'PENDING',
        attempt_count: 0,
        last_error: null,
        created_at: now,
        synced_at: null,
      };
      await insertDelivery(delivery);

      let sentNow = false;
      if (await isOnline()) {
        const result = await syncPendingDeliveries(session);
        onSessionChange(result.session);
        sentNow = result.sent > 0 && result.failed === 0;
      }
      setSynced(sentNow);
      setStage('DONE');
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar la entrega.');
      setStage('REVIEW');
    }
  };

  if (stage === 'ORDER_SCAN') {
    return (
      <View style={styles.fill}>
        <QrScanner title="Paso 1" instruction="Escanea el QR del morral" onScanned={scanOrder} onCancel={onClose} />
        {error ? <View style={styles.floatingError}><Text style={styles.errorText}>{error}</Text></View> : null}
      </View>
    );
  }

  if (stage === 'ROOM_SCAN') {
    return (
      <View style={styles.fill}>
        <QrScanner title="Paso 2" instruction="Escanea el QR de la habitación" onScanned={scanRoom} onCancel={onClose} />
        {error ? <View style={styles.floatingError}><Text style={styles.errorText}>{error}</Text></View> : null}
      </View>
    );
  }

  if (stage === 'LOCATING') {
    return (
      <View style={styles.center}>
        <View style={styles.locator}><LocateFixed size={46} color={colors.green} /><ActivityIndicator color={colors.green} /></View>
        <Text style={styles.bigTitle}>Obteniendo ubicación</Text>
        <Text style={styles.body}>Espera una posición precisa antes de guardar la entrega.</Text>
      </View>
    );
  }

  if (stage === 'DONE') {
    return (
      <View style={styles.center}>
        <CheckCircle2 size={70} color={colors.green} />
        <Text style={styles.bigTitle}>Entrega registrada</Text>
        <Text style={styles.body}>{synced ? 'El servidor ya confirmó el registro.' : 'Quedó guardada en el equipo y se enviará al recuperar conexión.'}</Text>
        <Button label="Registrar otra entrega" icon={PackageCheck} onPress={() => { setOrder(null); setRoom(null); setStage('ORDER_SCAN'); }} />
        <Button label="Volver al inicio" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  if (!order) return null;
  const mismatch = order.delivery_flow === 'FLUJO_1' && order.delivery_room_id !== room?.id;
  const isClientDelivery = order.delivery_flow === 'FLUJO_2';

  return (
    <ScrollView contentContainerStyle={styles.review}>
      <View style={styles.reviewHeader}>
        {isClientDelivery ? <Building2 size={34} color={colors.lime} /> : <MapPin size={34} color={colors.lime} />}
        <Text style={styles.eyebrow}>{isClientDelivery ? 'FLUJO 2' : 'FLUJO 1'}</Text>
        <Text style={styles.bigTitleLight}>{isClientDelivery ? 'Entrega al cliente' : 'Entrega en habitación'}</Text>
      </View>
      <View style={styles.details}>
        <Detail label="Morral" value={order.order_number || order.reference} />
        <Detail label="Trabajador" value={order.worker_name} />
        <Detail label="Empresa" value={order.company_name} />
        {isClientDelivery ? (
          <Detail label="Cliente receptor" value={order.client_name} />
        ) : (
          <>
            <Detail label="Habitación registrada" value={`${order.camp_name} · ${order.room_number}`} />
            <Detail label="Habitación escaneada" value={room ? `${room.camp_name} · ${room.number}` : '—'} />
          </>
        )}
      </View>
      {mismatch ? (
        <View style={styles.warning}>
          <AlertTriangle size={25} color={colors.amber} />
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>La habitación no coincide</Text>
            <Text style={styles.body}>Revisa ambas habitaciones. Si el trabajador cambió de pieza, debes confirmar una segunda vez para registrar de todas maneras.</Text>
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.errorBlock}>{error}</Text> : null}
      <Button
        label={mismatch ? 'Registrar de todas maneras' : 'Confirmar entrega y ubicación'}
        onPress={save}
        icon={mismatch ? AlertTriangle : LocateFixed}
        variant={mismatch ? 'danger' : 'primary'}
      />
      <Button label={isClientDelivery ? 'Volver a escanear' : 'Escanear otra habitación'} variant="secondary" onPress={() => setStage(isClientDelivery ? 'ORDER_SCAN' : 'ROOM_SCAN')} />
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, padding: 28, justifyContent: 'center', gap: 16, backgroundColor: colors.paper },
  locator: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  body: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 17, lineHeight: 23 },
  floatingError: { position: 'absolute', left: 16, right: 16, top: 130, padding: 12, borderRadius: 5, backgroundColor: colors.coralSoft },
  errorText: { color: '#8A2D1B', fontFamily: fonts.bodyMedium, fontSize: 15 },
  review: { flexGrow: 1, backgroundColor: colors.paper, paddingBottom: 30 },
  reviewHeader: { paddingTop: 66, paddingHorizontal: 22, paddingBottom: 24, backgroundColor: colors.ink },
  eyebrow: { marginTop: 12, color: colors.lime, fontFamily: fonts.bodyMedium, fontSize: 13 },
  bigTitleLight: { color: colors.surface, fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  details: { paddingHorizontal: 22, paddingVertical: 14 },
  detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  detailValue: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 19, marginTop: 2 },
  warning: { marginHorizontal: 22, marginBottom: 16, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.amber, backgroundColor: colors.amberSoft, flexDirection: 'row', gap: 11 },
  warningCopy: { flex: 1 },
  warningTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17, marginBottom: 3 },
  errorBlock: { marginHorizontal: 22, marginBottom: 14, color: '#8A2D1B', backgroundColor: colors.coralSoft, padding: 12, fontFamily: fonts.bodyMedium },
});