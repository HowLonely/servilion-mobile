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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>TRABAJO LOCAL</Text>
        <Text style={styles.title}>Entregas recientes</Text>
        <Text style={styles.subtitle}>Registros guardados durante los últimos 30 días.</Text>
      </View>
      {deliveries.length === 0 ? (
        <View style={styles.empty}><View style={styles.emptyIcon}><Clock3 size={28} color={colors.primary} /></View><Text style={styles.emptyTitle}>Sin entregas todavía</Text><Text style={styles.emptyText}>Los registros aparecerán aquí después de confirmar una entrega.</Text></View>
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
  return <View style={styles.state}><Icon size={15} color={state === 'SYNCED' ? colors.success : state === 'FAILED' ? colors.danger : colors.warning} /><Text style={styles.stateText}>{label}</Text></View>;
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