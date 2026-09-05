import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';
import { StatusBar } from 'expo-status-bar';
import { ClipboardList, Home, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { clearSession, loadSession } from './src/session';
import { getLastCatalogSync, getPendingCount, initializeDatabase, listDeliveries } from './src/database';
import { DeliveryScreen } from './src/screens/DeliveryScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { isOnline, refreshCatalog, syncPendingDeliveries } from './src/sync';
import { colors, fonts } from './src/theme';
import type { DeliveryRecord, Session } from './src/types';

type Tab = 'HOME' | 'HISTORY' | 'SETTINGS';

export default function App() {
  const [fontsLoaded] = useFonts({ BarlowCondensed_700Bold, SourceSans3_400Regular, SourceSans3_600SemiBold });
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('HOME');
  const [delivering, setDelivering] = useState(false);
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);

  const reloadLocalState = async () => {
    const [pending, syncedAt, recent] = await Promise.all([
      getPendingCount(),
      getLastCatalogSync(),
      listDeliveries(),
    ]);
    setPendingCount(pending);
    setLastSync(syncedAt);
    setDeliveries(recent);
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
      const refreshedSession = await refreshCatalog(sent.session);
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
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /></View>;
  }

  if (!session) return <LoginScreen onLogin={(value) => { setSession(value); setOnline(true); }} />;

  if (delivering) {
    return (
      <SafeAreaView style={styles.app}>
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
    <SafeAreaView style={styles.app}>
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
            onSync={() => { void runSync(); }}
          />
        ) : tab === 'HISTORY' ? (
          <HistoryScreen deliveries={deliveries} refreshing={syncing} onRefresh={() => { void runSync(); }} />
        ) : (
          <SettingsScreen session={session} lastSync={lastSync} onLogout={() => { void logout(); }} />
        )}
      </View>
      <View style={styles.nav}>
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
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}>
      <View>
        <Icon size={23} color={active ? colors.ink : colors.muted} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      {active ? <View style={styles.navIndicator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.paper },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  content: { flex: 1 },
  nav: { height: 68, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
  navLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  navLabelActive: { color: colors.ink },
  navIndicator: { position: 'absolute', top: 0, width: 34, height: 3, backgroundColor: colors.lime },
  badge: { position: 'absolute', top: -7, right: -14, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coral, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.surface, fontFamily: fonts.bodyMedium, fontSize: 10 },
});
