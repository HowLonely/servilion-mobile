import { randomUUID } from 'expo-crypto';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  LocateFixed,
  Minus,
  Plus,
  Tent,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/ui';
import { getLinenBalances, getLinenMovement, insertLinenMovement, listLinenMovements } from '../database';
import { campBalance, campsOf, totalOf } from '../linen';
import { getPreciseLocation } from '../location';
import { isOnline, refreshLinenBalances, syncPendingLinenMovements } from '../sync';
import { colors, fonts } from '../theme';
import type {
  LinenCompanyBalance,
  LinenKind,
  LinenMovementRecord,
  Session,
  StoredLinenLine,
} from '../types';

type Stage = 'KIND' | 'COMPANY' | 'CAMP' | 'LINES' | 'LOCATING' | 'DONE';
type Outcome = 'SENT' | 'QUEUED' | 'REJECTED';

type Props = {
  session: Session;
  online: boolean;
  onSessionChange: (session: Session) => void;
  onClose: () => void;
  onSaved: () => void;
};

const KIND_COPY: Record<LinenKind, { title: string; verb: string; hint: string }> = {
  REPARTO: {
    title: 'Repartir hotelería limpia',
    verb: 'Se entregan',
    hint: 'Hotelería limpia que dejas en el campamento.',
  },
  RETIRO: {
    title: 'Retirar hotelería sucia',
    verb: 'Se retiran',
    hint: 'Hotelería sucia que retiras del campamento para llevar a planta.',
  },
};

/**
 * Reparto y retiro de hotelería en faena.
 *
 * Funciona sin señal igual que las entregas: el movimiento queda en SQLite con
 * su hora y su GPS, y se envía al recuperar conexión. El saldo que se muestra
 * es el último descargado más lo que este teléfono registró y el servidor aún
 * no tiene (ver `linen.ts`).
 */
export function LinenScreen({ session, online, onSessionChange, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<LinenCompanyBalance[]>([]);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [movements, setMovements] = useState<LinenMovementRecord[]>([]);

  const [stage, setStage] = useState<Stage>('KIND');
  const [kind, setKind] = useState<LinenKind>('REPARTO');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [camp, setCamp] = useState<{ id: number; name: string } | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('QUEUED');
  const [rejection, setRejection] = useState('');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [stored, local] = await Promise.all([getLinenBalances(), listLinenMovements(500)]);
      if (!mounted) return;
      setBalances(stored.balances);
      setSnapshotAt(stored.snapshotAt);
      setMovements(local);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const company = balances.find((item) => item.company_id === companyId)
    ?? (balances.length === 1 ? balances[0] : undefined);

  const balance = useMemo(
    () => (company && camp ? campBalance(company, camp.id, movements, snapshotAt) : new Map<number, number>()),
    [company, camp, movements, snapshotAt],
  );

  const lines = company
    ? company.linen_types
        .map((type) => ({ type, quantity: Number(quantities[type.id] || 0) }))
        .filter((line) => line.quantity > 0)
    : [];
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  // Retirar más de lo que el sistema cree que hay se permite: en terreno se
  // registra lo que se contó. Solo se avisa, y el administrador lo corrige con
  // un conteo de inventario.
  const overdrawn = kind === 'RETIRO'
    ? lines.filter((line) => line.quantity > (balance.get(line.type.id) ?? 0))
    : [];

  const chooseKind = (value: LinenKind) => {
    setKind(value);
    setError('');
    setStage(balances.length > 1 && companyId === null ? 'COMPANY' : 'CAMP');
  };

  const chooseCamp = (value: { id: number; name: string }) => {
    setCamp(value);
    setQuantities({});
    setError('');
    setStage('LINES');
  };

  const back = () => {
    setError('');
    if (stage === 'LINES') setStage('CAMP');
    else if (stage === 'CAMP') setStage(balances.length > 1 ? 'COMPANY' : 'KIND');
    else if (stage === 'COMPANY') setStage('KIND');
    else onClose();
  };

  const save = async () => {
    if (!company || !camp || lines.length === 0) return;
    setStage('LOCATING');
    setError('');
    try {
      const position = await getPreciseLocation();
      const now = new Date().toISOString();
      const stored: StoredLinenLine[] = lines.map((line) => ({
        garment_type_id: line.type.id,
        quantity: line.quantity,
        name: line.type.name,
      }));
      const record: LinenMovementRecord = {
        client_uuid: randomUUID(),
        kind,
        company_id: company.company_id,
        company_name: company.company_name,
        camp_id: camp.id,
        camp_name: camp.name,
        lines_json: JSON.stringify(stored),
        total_quantity: total,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_meters: position.accuracy_meters,
        occurred_at: now,
        note: '',
        state: 'PENDING',
        attempt_count: 0,
        last_error: null,
        created_at: now,
        synced_at: null,
      };
      await insertLinenMovement(record);

      let result: Outcome = 'QUEUED';
      if (await isOnline()) {
        const sync = await syncPendingLinenMovements(session);
        let activeSession = sync.session;
        const saved = await getLinenMovement(record.client_uuid);
        if (saved?.state === 'SYNCED') result = 'SENT';
        if (saved?.state === 'REJECTED') {
          result = 'REJECTED';
          setRejection(saved.last_error ?? '');
        }
        // El saldo nuevo se baja al tiro para que el próximo movimiento parta
        // de lo que el servidor ya sabe. Si falla, se usa el guardado.
        try {
          activeSession = await refreshLinenBalances(activeSession);
        } catch {
          // Sin saldo nuevo se sigue con el anterior más la cola local.
        }
        onSessionChange(activeSession);
      }

      const [stored2, local] = await Promise.all([getLinenBalances(), listLinenMovements(500)]);
      setBalances(stored2.balances);
      setSnapshotAt(stored2.snapshotAt);
      setMovements(local);
      setOutcome(result);
      setStage('DONE');
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el movimiento.');
      setStage('LINES');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (balances.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.stateIcon}><Tent size={40} color={colors.primary} /></View>
        <Text style={styles.bigTitle}>Sin datos de hotelería</Text>
        <Text style={[styles.body, styles.centerText]}>
          {online
            ? 'Sincroniza desde el inicio para descargar los clientes, campamentos y tipos de hotelería.'
            : 'Conéctate y sincroniza antes de salir a ruta: el teléfono todavía no descarga los campamentos.'}
        </Text>
        <Button label="Volver al inicio" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  if (stage === 'LOCATING') {
    return (
      <View style={styles.center}>
        <View style={styles.stateIcon}><LocateFixed size={42} color={colors.primary} /></View>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.bigTitle}>Obteniendo ubicación</Text>
        <Text style={[styles.body, styles.centerText]}>Espera una posición precisa antes de guardar el movimiento.</Text>
      </View>
    );
  }

  if (stage === 'DONE') {
    const rejected = outcome === 'REJECTED';
    return (
      <View style={styles.center}>
        <View style={[styles.stateIcon, rejected ? styles.dangerIcon : styles.successIcon]}>
          {rejected ? <AlertTriangle size={46} color={colors.danger} /> : <CheckCircle2 size={48} color={colors.success} />}
        </View>
        <Text style={styles.bigTitle}>{rejected ? 'El servidor lo rechazó' : kind === 'REPARTO' ? 'Reparto registrado' : 'Retiro registrado'}</Text>
        <Text style={[styles.body, styles.centerText]}>
          {rejected
            ? rejection || 'Revisa el movimiento en el historial.'
            : `${camp?.name} · ${total} ${total === 1 ? 'pieza' : 'piezas'}. ${
              outcome === 'SENT'
                ? 'El servidor ya confirmó el registro.'
                : 'Quedó guardado en el equipo y se enviará al recuperar conexión.'
            }`}
        </Text>
        <Button label="Registrar otro movimiento" icon={kind === 'REPARTO' ? ArrowDownToLine : ArrowUpFromLine} onPress={() => { setQuantities({}); setStage('CAMP'); }} />
        <Button label="Volver al inicio" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Atrás" onPress={back} style={styles.backButton}>
          <ChevronLeft size={26} color={colors.ink} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>HOTELERÍA DE HOTELERÍA</Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {stage === 'KIND' ? 'Qué vas a registrar' : KIND_COPY[kind].title}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stage === 'KIND' ? (
          <>
            <KindOption
              icon={ArrowDownToLine}
              title="Reparto a campamento"
              text="Dejas hotelería limpia en un campamento."
              onPress={() => chooseKind('REPARTO')}
            />
            <KindOption
              icon={ArrowUpFromLine}
              title="Retiro de sucio"
              text="Retiras hotelería sucia de un campamento para llevar a planta."
              onPress={() => chooseKind('RETIRO')}
            />
            {snapshotAt ? <Text style={styles.snapshot}>Saldos descargados el {formatTime(snapshotAt)}.</Text> : null}
          </>
        ) : null}

        {stage === 'COMPANY' ? balances.map((item) => (
          <Choice
            key={item.company_id}
            title={item.company_name}
            subtitle={item.faena_name}
            onPress={() => { setCompanyId(item.company_id); setStage('CAMP'); }}
          />
        )) : null}

        {stage === 'CAMP' && company ? (
          campsOf(company).length === 0 ? (
            <Text style={styles.body}>{company.company_name} no tiene campamentos activos en su faena.</Text>
          ) : campsOf(company).map((item) => {
            const campTotal = totalOf(campBalance(company, item.id, movements, snapshotAt));
            return (
              <Choice
                key={item.id}
                title={item.name}
                subtitle={`Saldo: ${campTotal.toLocaleString('es-CL')} piezas`}
                warn={campTotal < 0}
                onPress={() => chooseCamp(item)}
              />
            );
          })
        ) : null}

        {stage === 'LINES' && company && camp ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>{KIND_COPY[kind].hint}</Text>
              <Text style={styles.summaryTitle}>{camp.name}</Text>
            </View>

            <View style={styles.lines}>
              {company.linen_types.map((type, index) => {
                const value = quantities[type.id] ?? '';
                const quantity = Number(value || 0);
                const current = balance.get(type.id) ?? 0;
                const set = (next: number) =>
                  setQuantities((previous) => ({ ...previous, [type.id]: next > 0 ? String(next) : '' }));
                return (
                  <View key={type.id} style={[styles.lineRow, index > 0 && styles.lineBorder]}>
                    <View style={styles.lineCopy}>
                      <Text style={styles.lineName}>{type.name}</Text>
                      <Text style={[styles.lineHint, current < 0 && styles.negative]}>
                        En el campamento: {current.toLocaleString('es-CL')}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Restar ${type.name}`}
                      disabled={quantity <= 0}
                      onPress={() => set(quantity - 1)}
                      style={[styles.stepper, quantity <= 0 && styles.muted]}
                    >
                      <Minus size={20} color={colors.ink} />
                    </Pressable>
                    <TextInput
                      accessibilityLabel={`Piezas de ${type.name}`}
                      keyboardType="number-pad"
                      value={value}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      onChangeText={(text) =>
                        setQuantities((previous) => ({ ...previous, [type.id]: text.replace(/\D/g, '') }))}
                      style={styles.quantityInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sumar ${type.name}`}
                      onPress={() => set(quantity + 1)}
                      style={styles.stepper}
                    >
                      <Plus size={20} color={colors.ink} />
                    </Pressable>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{KIND_COPY[kind].verb}</Text>
                <Text style={styles.totalValue}>{total.toLocaleString('es-CL')} {total === 1 ? 'pieza' : 'piezas'}</Text>
              </View>
            </View>

            {overdrawn.length > 0 ? (
              <View style={styles.warning}>
                <AlertTriangle size={24} color={colors.warning} />
                <View style={styles.warningCopy}>
                  <Text style={styles.warningTitle}>Más de lo que el sistema tiene registrado</Text>
                  <Text style={styles.body}>
                    {overdrawn.map((line) => line.type.name).join(', ')} quedará en negativo en {camp.name}.
                    Se registra igual y un administrador lo corrige con un conteo.
                  </Text>
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.errorBlock}>{error}</Text> : null}

            <Button
              label="Confirmar y guardar ubicación"
              icon={LocateFixed}
              disabled={total === 0}
              onPress={() => { void save(); }}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function KindOption({ icon: Icon, title, text, onPress }: {
  icon: typeof Tent;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kind, pressed && styles.pressed]}>
      <View style={styles.kindIcon}><Icon size={30} color={colors.primary} /></View>
      <View style={styles.kindCopy}>
        <Text style={styles.kindTitle}>{title}</Text>
        <Text style={styles.body}>{text}</Text>
      </View>
    </Pressable>
  );
}

function Choice({ title, subtitle, warn = false, onPress }: {
  title: string;
  subtitle?: string;
  warn?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
      <Text style={styles.choiceTitle}>{title}</Text>
      {subtitle ? <Text style={[styles.choiceSubtitle, warn && styles.negative]}>{subtitle}</Text> : null}
    </Pressable>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: colors.paper },
  centerText: { textAlign: 'center' },
  stateIcon: { width: 76, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  successIcon: { backgroundColor: colors.successSoft },
  dangerIcon: { backgroundColor: colors.dangerSoft },
  bigTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, lineHeight: 33, textAlign: 'center' },
  body: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 12 },
  topTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 21 },
  content: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 28 },
  kind: { minHeight: 110, padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  kindIcon: { width: 58, height: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  kindCopy: { flex: 1 },
  kindTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 21, marginBottom: 2 },
  pressed: { opacity: 0.75 },
  snapshot: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 4 },
  choice: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  choiceTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 19 },
  choiceSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, marginTop: 2 },
  negative: { color: colors.danger, fontFamily: fonts.bodyMedium },
  summary: { padding: 14, borderRadius: 10, backgroundColor: colors.primarySoft },
  summaryLabel: { color: colors.primaryDark, fontFamily: fonts.body, fontSize: 14 },
  summaryTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  lines: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  lineCopy: { flex: 1 },
  lineName: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 18 },
  lineHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  stepper: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  muted: { opacity: 0.4 },
  quantityInput: { width: 70, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, textAlign: 'center', color: colors.ink, fontFamily: fonts.display, fontSize: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  totalLabel: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 15 },
  totalValue: { color: colors.ink, fontFamily: fonts.display, fontSize: 22 },
  warning: { padding: 14, borderLeftWidth: 4, borderLeftColor: colors.warning, borderRadius: 8, backgroundColor: colors.warningSoft, flexDirection: 'row', gap: 11 },
  warningCopy: { flex: 1 },
  warningTitle: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 17, marginBottom: 3 },
  errorBlock: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 8, fontFamily: fonts.bodyMedium },
});
