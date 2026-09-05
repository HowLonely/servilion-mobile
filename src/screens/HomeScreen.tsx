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
          <Text style={styles.kicker}>SERVILION · FAENA</Text>
          <Text style={styles.title}>Hola, {name}</Text>
        </View>
        <StatusTag online={online} />
      </View>

      <Pressable accessibilityRole="button" onPress={onScan} style={({ pressed }) => [styles.scanAction, pressed && styles.pressed]}>
        <View style={styles.scanIcon}><ScanLine size={50} color={colors.ink} strokeWidth={1.8} /></View>
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
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{lastSync ? formatTime(lastSync) : '—'}</Text>
          <Text style={styles.metricLabel}>Última descarga</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado de ruta</Text>
        <View style={styles.statusRow}>
          {online ? <ShieldCheck size={24} color={colors.green} /> : <WifiOff size={24} color={colors.amber} />}
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
        <MapPinCheck size={23} color={colors.coral} />
        <Text style={styles.locationText}>La ubicación precisa se solicita al confirmar cada entrega.</Text>
      </View>
    </ScrollView>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: colors.paper, paddingBottom: 30 },
  header: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: colors.green, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 36, lineHeight: 39 },
  scanAction: { marginHorizontal: 16, minHeight: 178, padding: 22, borderRadius: 7, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 18 },
  pressed: { opacity: 0.8 },
  scanIcon: { width: 76, height: 76, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  scanCopy: { flex: 1 },
  scanTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 35 },
  scanSubtitle: { color: colors.limeDark, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, marginTop: 5 },
  metrics: { marginTop: 18, paddingVertical: 20, backgroundColor: colors.ink, flexDirection: 'row' },
  metric: { flex: 1, paddingHorizontal: 20 },
  metricValue: { color: colors.surface, fontFamily: fonts.display, fontSize: 29 },
  metricLabel: { color: '#B9C3BC', fontFamily: fonts.body, fontSize: 14 },
  divider: { width: 1, backgroundColor: '#47534B' },
  section: { padding: 20, gap: 15 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 27 },
  statusRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17 },
  body: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  error: { color: '#8A2D1B', backgroundColor: colors.coralSoft, padding: 10, fontFamily: fonts.bodyMedium },
  locationNote: { marginHorizontal: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', gap: 10 },
  locationText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
});