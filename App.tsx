import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';
import { StatusBar } from 'expo-status-bar';
import { ClipboardList, Home, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { clearSession, loadSession } from './src/session';
import { getLastCatalogSync, getPendingCount, initializeDatabase, listDeliveries, listLinenMovements } from './src/database';
import { DeliveryScreen } from './src/screens/DeliveryScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LinenScreen } from './src/screens/LinenScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  isOnline,
  refreshCatalog,
  refreshLinenBalances,
  syncPendingDeliveries,
  syncPendingLinenMovements,
} from './src/sync';
import { colors, fonts } from './src/theme';
import type { DeliveryRecord, LinenMovementRecord, Session } from './src/types';

type Tab = 'HOME' | 'HISTORY' | 'SETTINGS';

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const [fontsLoaded] = useFonts({ SourceSans3_400Regular, SourceSans3_600SemiBold });
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('HOME');
  const [delivering, setDelivering] = useState(false);
  const [registeringLinen, setRegisteringLinen] = useState(false);
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [linenMovements, setLinenMovements] = useState<LinenMovementRecord[]>([]);

  const reloadLocalState = async () => {
    const [pending, syncedAt, recent, recentLinen] = await Promise.all([
      getPendingCount(),
      getLastCatalogSync(),
      listDeliveries(),
      listLinenMovements(),
    ]);
    setPendingCount(pending);
    setLastSync(syncedAt);
    setDeliveries(recent);
    setLinenMovements(recentLinen);
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await initializeDatabase();
      const [storedSession, connected] = await Promise.all([loadSession(), isOnline()]);
      if (!mounted) return;
      setSession(storedSession);
      setOnline(connected);
      await reloadLocalState();
      if (mounted) setReady(true);
    })();
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (ready && session && online && !syncing) void runSync();
  }, [ready, online, session?.access]);

  const runSync = async () => {
    if (!session || syncing) return;
    setSyncing(true);
    setSyncError('');
    try {
      const sent = await syncPendingDeliveries(session);
      const linen = await syncPendingLinenMovements(sent.session);
      let refreshedSession = await refreshCatalog(linen.session);
      // La hotelería va aparte y no corta la sincronización de entregas: si el
      // saldo no baja, se sigue trabajando con el último descargado.
      try {
        refreshedSession = await refreshLinenBalances(refreshedSession);
      } catch (caught) {
        setSyncError(caught instanceof Error ? `Saldos de hotelería: ${caught.message}` : 'No se pudieron descargar los saldos de hotelería.');
      }
      setSession(refreshedSession);
      await reloadLocalState();
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : 'No se pudo sincronizar.');
      await reloadLocalState();
    } finally {
      setSyncing(false);
    }
  };

  const logout = async () => {
    await clearSession();
    setSession(null);
    setTab('HOME');
  };

  if (!fontsLoaded || !ready) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
        <StatusBar style="dark" />
        <LoginScreen onLogin={(value) => { setSession(value); setOnline(true); }} />
      </SafeAreaView>
    );
  }

  if (registeringLinen) {
    return (
      <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
        <StatusBar style="dark" />
        <LinenScreen
          session={session}
          online={online}
          onSessionChange={setSession}
          onClose={() => setRegisteringLinen(false)}
          onSaved={() => { void reloadLocalState(); }}
        />
      </SafeAreaView>
    );
  }

  if (delivering) {
    return (
      <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
        <StatusBar style="light" />
        <DeliveryScreen
          session={session}
          online={online}
          onSessionChange={setSession}
          onClose={() => setDelivering(false)}
          onSaved={() => { void reloadLocalState(); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {tab === 'HOME' ? (
          <HomeScreen
            session={session}
            online={online}
            pendingCount={pendingCount}
            lastSync={lastSync}
            syncing={syncing}
            syncError={syncError}
            onScan={() => setDelivering(true)}
            onLinen={() => setRegisteringLinen(true)}
            onSync={() => { void runSync(); }}
          />
        ) : tab === 'HISTORY' ? (
          <HistoryScreen
            deliveries={deliveries}
            linenMovements={linenMovements}
            refreshing={syncing}
            onRefresh={() => { void runSync(); }}
          />
        ) : (
          <SettingsScreen session={session} lastSync={lastSync} onLogout={() => { void logout(); }} />
        )}
      </View>
      <View style={styles.nav} accessibilityRole="tablist">
        <NavItem label="Inicio" icon={Home} active={tab === 'HOME'} onPress={() => setTab('HOME')} />
        <NavItem label="Historial" icon={ClipboardList} active={tab === 'HISTORY'} onPress={() => setTab('HISTORY')} badge={pendingCount} />
        <NavItem label="Ajustes" icon={Settings} active={tab === 'SETTINGS'} onPress={() => setTab('SETTINGS')} />
      </View>
    </SafeAreaView>
  );
}

function NavItem({ label, icon: Icon, active, onPress, badge = 0 }: {
  label: string;
  icon: typeof Home;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={styles.navItem}>
      <View style={[styles.navIcon, active && styles.navIconActive]}>
        <Icon size={22} color={active ? colors.primary : colors.muted} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  content: { flex: 1, backgroundColor: colors.paper },
  nav: { height: 68, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' },
  navIcon: { width: 40, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: colors.primarySoft },
  navLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  navLabelActive: { color: colors.primary },
  badge: { position: 'absolute', top: -5, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.surface, fontFamily: fonts.bodyMedium, fontSize: 10 },
});
