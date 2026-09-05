import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import type { DeliveryRecord } from '../types';

export function HistoryScreen({ deliveries, refreshing, onRefresh }: {
  deliveries: DeliveryRecord[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <Text style={styles.kicker}>TRABAJO LOCAL</Text>
      <Text style={styles.title}>Entregas recientes</Text>
      <Text style={styles.subtitle}>Los registros confirmados permanecen 30 días en este equipo.</Text>
      {deliveries.length === 0 ? (
        <View style={styles.empty}><Clock3 size={34} color={colors.muted} /><Text style={styles.emptyText}>Todavía no hay entregas guardadas.</Text></View>
      ) : deliveries.map((delivery) => (
        <View key={delivery.client_uuid} style={styles.row}>
          <View style={[styles.stateBar, delivery.state === 'SYNCED' ? styles.synced : delivery.state === 'FAILED' ? styles.failed : styles.pending]} />
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
      ))}
    </ScrollView>
  );
}

function State({ state }: { state: DeliveryRecord['state'] }) {
  const Icon = state === 'SYNCED' ? CheckCircle2 : state === 'FAILED' ? AlertCircle : Clock3;
  const label = state === 'SYNCED' ? 'Enviada' : state === 'FAILED' ? 'Reintentar' : 'Pendiente';
  return <View style={styles.state}><Icon size={15} color={state === 'SYNCED' ? colors.green : state === 'FAILED' ? colors.coral : colors.amber} /><Text style={styles.stateText}>{label}</Text></View>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 58, paddingHorizontal: 18, paddingBottom: 30, backgroundColor: colors.paper },
  kicker: { color: colors.green, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, marginBottom: 22 },
  empty: { marginTop: 35, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 16 },
  row: { marginBottom: 10, backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', overflow: 'hidden' },
  stateBar: { width: 5 },
  synced: { backgroundColor: colors.green },
  failed: { backgroundColor: colors.coral },
  pending: { backgroundColor: colors.amber },
  rowBody: { flex: 1, padding: 13 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stateText: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12 },
  person: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 16 },
  meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, marginTop: 2 },
  time: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 7 },
  error: { color: '#8A2D1B', fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 6 },
});