import { AlertCircle, Ban, CheckCircle2, Clock3 } from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { parseLines } from '../linen';
import { colors, fonts } from '../theme';
import type { DeliveryRecord, LinenMovementRecord, LinenMovementState } from '../types';

type Entry =
  | { type: 'DELIVERY'; at: string; record: DeliveryRecord }
  | { type: 'LINEN'; at: string; record: LinenMovementRecord };

export function HistoryScreen({ deliveries, linenMovements, refreshing, onRefresh }: {
  deliveries: DeliveryRecord[];
  linenMovements: LinenMovementRecord[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // Una sola lista por fecha: el supervisor recorre su turno en el orden en que
  // lo hizo, sin tener que saltar entre entregas y hotelería.
  const entries: Entry[] = [
    ...deliveries.map((record): Entry => ({ type: 'DELIVERY', at: record.delivered_at, record })),
    ...linenMovements.map((record): Entry => ({ type: 'LINEN', at: record.occurred_at, record })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>TRABAJO LOCAL</Text>
        <Text style={styles.title}>Registros recientes</Text>
        <Text style={styles.subtitle}>Entregas y hotelería guardadas durante los últimos 30 días.</Text>
      </View>
      {entries.length === 0 ? (
        <View style={styles.empty}><View style={styles.emptyIcon}><Clock3 size={28} color={colors.primary} /></View><Text style={styles.emptyTitle}>Sin registros todavía</Text><Text style={styles.emptyText}>Aparecerán aquí después de confirmar una entrega o un movimiento de hotelería.</Text></View>
      ) : entries.map((entry) => (
        entry.type === 'DELIVERY'
          ? <DeliveryRow key={entry.record.client_uuid} delivery={entry.record} />
          : <LinenRow key={entry.record.client_uuid} movement={entry.record} />
      ))}
    </ScrollView>
  );
}

function DeliveryRow({ delivery }: { delivery: DeliveryRecord }) {
  return (
    <View style={styles.row}>
      <View style={[styles.stateBar, barStyle(delivery.state)]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.code}>{delivery.order_code}</Text>
          <State state={delivery.state} />
        </View>
        <Text style={styles.person}>{delivery.worker_name}</Text>
        <Text style={styles.meta}>{delivery.company_name} · {delivery.delivery_flow === 'FLUJO_1' ? delivery.scanned_room_label : 'Entrega al cliente'}</Text>
        <Text style={styles.time}>{formatDate(delivery.delivered_at)}</Text>
        {delivery.last_error ? <Text style={styles.error}>{delivery.last_error}</Text> : null}
      </View>
    </View>
  );
}

function LinenRow({ movement }: { movement: LinenMovementRecord }) {
  const detail = parseLines(movement.lines_json)
    .map((line) => `${line.name} ${line.quantity}`)
    .join(' · ');
  return (
    <View style={styles.row}>
      <View style={[styles.stateBar, barStyle(movement.state)]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.code}>{movement.kind === 'REPARTO' ? 'Reparto' : 'Retiro'} · {movement.total_quantity}</Text>
          <State state={movement.state} />
        </View>
        <Text style={styles.person}>{movement.camp_name}</Text>
        <Text style={styles.meta}>{movement.company_name} · {detail}</Text>
        <Text style={styles.time}>{formatDate(movement.occurred_at)}</Text>
        {movement.last_error ? <Text style={styles.error}>{movement.last_error}</Text> : null}
      </View>
    </View>
  );
}

function barStyle(state: LinenMovementState) {
  if (state === 'SYNCED') return styles.synced;
  if (state === 'FAILED' || state === 'REJECTED') return styles.failed;
  return styles.pending;
}

function State({ state }: { state: LinenMovementState }) {
  const Icon = state === 'SYNCED' ? CheckCircle2 : state === 'REJECTED' ? Ban : state === 'FAILED' ? AlertCircle : Clock3;
  const label = state === 'SYNCED' ? 'Enviado' : state === 'REJECTED' ? 'Rechazado' : state === 'FAILED' ? 'Reintentar' : 'Pendiente';
  const color = state === 'SYNCED' ? colors.success : state === 'FAILED' || state === 'REJECTED' ? colors.danger : colors.warning;
  return <View style={styles.state}><Icon size={15} color={color} /><Text style={styles.stateText}>{label}</Text></View>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: colors.paper },
  header: { marginBottom: 18 },
  kicker: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 35 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, marginTop: 3 },
  empty: { marginTop: 24, padding: 28, alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  emptyIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: 4 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17 },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, textAlign: 'center' },
  row: { marginBottom: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', overflow: 'hidden' },
  stateBar: { width: 4 },
  synced: { backgroundColor: colors.success },
  failed: { backgroundColor: colors.danger },
  pending: { backgroundColor: colors.warning },
  rowBody: { flex: 1, padding: 13 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: colors.ink, fontFamily: fonts.display, fontSize: 21 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stateText: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12 },
  person: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 16 },
  meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, marginTop: 2 },
  time: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 7 },
  error: { color: '#8A2D1B', fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 6 },
});
