import { LockKeyhole, Server, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { login } from '../api';
import { colors, fonts } from '../theme';
import type { Session } from '../types';
import { Button } from '../components/ui';

type Props = { onLogin: (session: Session) => void };

export function LoginScreen({ onLogin }: Props) {
  const [apiUrl, setApiUrl] = useState('http://10.0.2.2:8000');
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
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>SERVILION</Text>
        <Text style={styles.product}>ENTREGAS EN FAENA</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.heading}>Ingreso operativo</Text>
        <Text style={styles.caption}>La sesión queda protegida en este equipo para seguir trabajando sin señal.</Text>
        <Field icon={Server} label="Servidor" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
        <Field icon={UserRound} label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Field icon={LockKeyhole} label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Ingresar" onPress={submit} loading={loading} />
      </View>
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
  screen: { flex: 1, justifyContent: 'space-between', backgroundColor: colors.paper },
  brandBlock: { backgroundColor: colors.ink, paddingTop: 78, paddingBottom: 38, paddingHorizontal: 24 },
  brand: { color: colors.lime, fontFamily: fonts.display, fontSize: 52, lineHeight: 52 },
  product: { color: colors.surface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  form: { padding: 24, paddingBottom: 42, gap: 15 },
  heading: { color: colors.ink, fontFamily: fonts.display, fontSize: 35 },
  caption: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, marginBottom: 4 },
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
    borderRadius: 5,
  },
  input: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 17 },
  error: { color: '#9B311D', backgroundColor: colors.coralSoft, padding: 10, borderRadius: 4, fontFamily: fonts.bodyMedium },
});