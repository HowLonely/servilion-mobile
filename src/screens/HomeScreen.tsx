import { MapPinCheck, RefreshCw, ScanLine, ShieldCheck, WifiOff } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, StatusTag } from '../components/ui';
import { colors, fonts } from '../theme';
import type { Session } from '../types';

type Props = {
  session: Session;
  online: boolean;
  pendingCount: number;
  lastSync: string | null;
  syncing: boolean;
  syncError: string;
  onScan: () => void;
  onSync: () => void;
};

export function HomeScreen({
  session,
  online,
  pendingCount,
  lastSync,
  syncing,
  syncError,
  onScan,
  onSync,
}: Props) {
  const name = session.user.first_name || session.user.username;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ENTREGAS EN FAENA</Text>
          <Text style={styles.title}>Hola, {name}</Text>
        </View>
        <StatusTag online={online} />
      </View>

      <Pressable accessibilityRole="button" onPress={onScan} style={({ pressed }) => [styles.scanAction, pressed && styles.pressed]}>
        <View style={styles.scanIcon}><ScanLine size={42} color={colors.primary} strokeWidth={2} /></View>
        <View style={styles.scanCopy}>
          <Text style={styles.scanTitle}>Registrar entrega</Text>
          <Text style={styles.scanSubtitle}>Comienza escaneando el QR del morral</Text>
        </View>
      </Pressable>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>Pendientes de enviar</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{lastSync ? formatTime(lastSync) : '—'}</Text>
          <Text style={styles.metricLabel}>Última descarga</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado de ruta</Text>
        <View style={styles.statusRow}>
          {online ? <ShieldCheck size={24} color={colors.success} /> : <WifiOff size={24} color={colors.warning} />}
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{online ? 'Listo para sincronizar' : 'Puedes seguir entregando'}</Text>
            <Text style={styles.body}>
              {online
                ? 'Las entregas se envían al servidor al terminar.'
                : 'Cada entrega queda en SQLite con hora y GPS hasta recuperar señal.'}
            </Text>
          </View>
        </View>
        {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
        <Button
          label={online ? 'Sincronizar ahora' : 'Sin conexión disponible'}
          icon={RefreshCw}
          variant="secondary"
          disabled={!online}
          loading={syncing}
          onPress={onSync}
        />
      </View>

      <View style={styles.locationNote}>
        <MapPinCheck size={23} color={colors.primary} />
        <Text style={styles.locationText}>La ubicación precisa se solicita al confirmar cada entrega.</Text>
      </View>
    </ScrollView>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: colors.paper, paddingBottom: 24 },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 35 },
  scanAction: { marginHorizontal: 16, minHeight: 150, padding: 20, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  pressed: { opacity: 0.8 },
  scanIcon: { width: 70, height: 70, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  scanCopy: { flex: 1 },
  scanTitle: { color: colors.surface, fontFamily: fonts.display, fontSize: 27, lineHeight: 31 },
  scanSubtitle: { color: colors.primarySoft, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, marginTop: 5 },
  metrics: { marginTop: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  metric: { flex: 1, minHeight: 102, padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  metricValue: { color: colors.ink, fontFamily: fonts.display, fontSize: 26 },
  metricLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 18 },
  section: { marginHorizontal: 16, marginTop: 14, padding: 16, gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 20 },
  statusRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17 },
  body: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, fontFamily: fonts.bodyMedium },
  locationNote: { marginHorizontal: 20, marginTop: 18, flexDirection: 'row', gap: 10 },
  locationText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
});