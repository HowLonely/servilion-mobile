import { Database, LogOut, Server, UserRound } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { colors, fonts } from '../theme';
import type { Session } from '../types';

export function SettingsScreen({ session, lastSync, onLogout }: { session: Session; lastSync: string | null; onLogout: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>CONFIGURACIÓN</Text>
        <Text style={styles.title}>Este equipo</Text>
      </View>
      <View style={styles.section}>
        <Info icon={UserRound} label="Sesión" value={`${session.user.first_name} ${session.user.last_name}`.trim() || session.user.username} />
        <Info icon={Server} label="Servidor" value={session.apiUrl} />
        <Info icon={Database} label="Última descarga" value={lastSync ? new Date(lastSync).toLocaleString('es-CL') : 'Aún no sincronizado'} />
      </View>
      <View style={styles.policy}>
        <Text style={styles.policyTitle}>Almacenamiento offline</Text>
        <Text style={styles.policyText}>Las órdenes, habitaciones y saldos de hotelería se descargan antes de la ruta. Las entregas y movimientos de hotelería enviados se conservan 30 días; los pendientes nunca se eliminan.</Text>
      </View>
      <Button label="Cerrar sesión" icon={LogOut} variant="danger" onPress={onLogout} />
    </ScrollView>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}><Icon size={20} color={colors.primary} /></View>
      <View style={styles.infoCopy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: colors.paper, gap: 14 },
  header: { marginBottom: 4 },
  kicker: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 35 },
  section: { paddingHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  info: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  infoCopy: { flex: 1 },
  label: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  value: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 16, marginTop: 2 },
  policy: { padding: 16, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 8, backgroundColor: colors.surface },
  policyTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17 },
  policyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, marginTop: 4 },
});