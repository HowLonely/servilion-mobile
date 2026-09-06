import { LockKeyhole, Server, UserRound, WashingMachine } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { login } from '../api';
import { colors, fonts } from '../theme';
import type { Session } from '../types';
import { Button } from '../components/ui';

type Props = { onLogin: (session: Session) => void };

export function LoginScreen({ onLogin }: Props) {
  const [apiUrl, setApiUrl] = useState('https://api.34-228-25-198.nip.io');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!apiUrl.trim() || !username.trim() || !password) {
      setError('Completa servidor, usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await login(apiUrl, username, password);
      if (!['SUPERVISOR', 'ADMIN'].includes(session.user.role)) {
        throw new Error(`El rol ${session.user.role} no puede registrar entregas.`);
      }
      onLogin(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brandBlock}>
          <View style={styles.brandIcon}><WashingMachine size={25} color={colors.surface} /></View>
          <View>
            <Text style={styles.brand}>Servilion</Text>
            <Text style={styles.product}>Lavandería industrial</Text>
          </View>
        </View>
        <View style={styles.intro}>
          <Text style={styles.heading}>Entregas en faena</Text>
          <Text style={styles.caption}>Ingresa para registrar entregas, incluso cuando estés sin conexión.</Text>
        </View>
        <View style={styles.form}>
          <Field icon={Server} label="Servidor" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
          <Field icon={UserRound} label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Field icon={LockKeyhole} label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Ingresar" onPress={submit} loading={loading} />
        </View>
        <Text style={styles.footer}>La sesión y el catálogo se guardan de forma segura en este equipo.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  icon: typeof Server;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: 'none';
  secureTextEntry?: boolean;
};

function Field({ icon: Icon, label, ...inputProps }: FieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Icon size={19} color={colors.muted} />
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 40 },
  brandIcon: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  brand: { color: colors.ink, fontFamily: fonts.display, fontSize: 23, lineHeight: 25 },
  product: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  intro: { marginBottom: 20 },
  form: { padding: 20, gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  heading: { color: colors.ink, fontFamily: fonts.display, fontSize: 31, lineHeight: 36 },
  caption: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, marginTop: 4 },
  label: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 5 },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  input: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 17 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 8, fontFamily: fonts.bodyMedium },
  footer: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
});