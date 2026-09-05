import { Database, LogOut, Server, UserRound } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { colors, fonts } from '../theme';
import type { Session } from '../types';

export function SettingsScreen({ session, lastSync, onLogout }: { session: Session; lastSync: string | null; onLogout: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>CONFIGURACIÓN</Text>
      <Text style={styles.title}>Este equipo</Text>
      <View style={styles.section}>
        <Info icon={UserRound} label="Sesión" value={`${session.user.first_name} ${session.user.last_name}`.trim() || session.user.username} />
        <Info icon={Server} label="Servidor" value={session.apiUrl} />
        <Info icon={Database} label="Última descarga" value={lastSync ? new Date(lastSync).toLocaleString('es-CL') : 'Aún no sincronizado'} />
      </View>
      <View style={styles.policy}>
        <Text style={styles.policyTitle}>Almacenamiento offline</Text>
        <Text style={styles.policyText}>Las órdenes y habitaciones se descargan antes de la ruta. Las entregas enviadas se conservan 30 días; las pendientes nunca se eliminan.</Text>
      </View>
      <Button label="Cerrar sesión" icon={LogOut} variant="danger" onPress={onLogout} />
    </ScrollView>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Icon size={22} color={colors.green} />
      <View style={styles.infoCopy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 58, paddingHorizontal: 20, paddingBottom: 32, backgroundColor: colors.paper, gap: 18 },
  kicker: { color: colors.green, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, lineHeight: 40, marginTop: -14 },
  section: { borderTopWidth: 1, borderTopColor: colors.line },
  info: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', gap: 12 },
  infoCopy: { flex: 1 },
  label: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  value: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 16, marginTop: 2 },
  policy: { padding: 16, borderLeftWidth: 4, borderLeftColor: colors.lime, backgroundColor: colors.surface },
  policyTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17 },
  policyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, marginTop: 4 },
});