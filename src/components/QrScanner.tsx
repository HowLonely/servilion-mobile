import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, fonts } from '../theme';
import { Button } from './ui';

type Props = {
  title: string;
  instruction: string;
  onScanned: (value: string) => void;
  onCancel: () => void;
};

export function QrScanner({ title, instruction, onScanned, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const submit = (value: string) => {
    const normalized = value.trim();
    if (!normalized || locked) return;
    setLocked(true);
    onScanned(normalized);
  };

  if (!permission) {
    return <View style={styles.permission}><Text style={styles.copy}>Preparando cámara…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Camera size={42} color={colors.coral} />
        <Text style={styles.permissionTitle}>Permiso de cámara</Text>
        <Text style={styles.copy}>La cámara es necesaria para identificar el morral y la habitación.</Text>
        <Button label="Permitir cámara" onPress={requestPermission} icon={Camera} />
        <Button label="Cancelar" onPress={onCancel} variant="secondary" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : ({ data }) => submit(data)}
      />
      <View style={styles.shade} />
      <View style={styles.topbar}>
        <View style={styles.titleWrap}>
          <Text style={styles.step}>{title}</Text>
          <Text style={styles.instruction}>{instruction}</Text>
        </View>
        <Pressable accessibilityLabel="Cerrar escáner" onPress={onCancel} style={styles.iconButton}>
          <X color={colors.surface} size={25} />
        </Pressable>
      </View>
      <View style={styles.frame}><View style={styles.scanLine} /></View>
      <View style={styles.manualPanel}>
        <Text style={styles.manualLabel}>Código ilegible</Text>
        <View style={styles.manualRow}>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setManualCode}
            onSubmitEditing={() => { Keyboard.dismiss(); submit(manualCode); }}
            placeholder="Escribir código"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={manualCode}
          />
          <Pressable
            accessibilityLabel="Usar código escrito"
            onPress={() => submit(manualCode)}
            style={styles.submitButton}
          >
            <Text style={styles.submitText}>Usar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  shade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(8, 15, 11, 0.26)' },
  topbar: {
    paddingTop: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleWrap: { flex: 1, paddingRight: 12 },
  step: { color: colors.lime, fontFamily: fonts.bodyMedium, fontSize: 14, textTransform: 'uppercase' },
  instruction: { color: colors.surface, fontFamily: fonts.display, fontSize: 31, lineHeight: 34 },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 23,
  },
  frame: {
    position: 'absolute',
    width: 260,
    height: 260,
    left: '50%',
    top: '42%',
    marginLeft: -130,
    marginTop: -130,
    borderWidth: 3,
    borderColor: colors.lime,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scanLine: { height: 3, backgroundColor: colors.coral, marginTop: 128 },
  manualPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    padding: 14,
    borderRadius: 6,
    backgroundColor: colors.paper,
  },
  manualLabel: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 7 },
  manualRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  submitButton: { height: 48, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: colors.lime, borderRadius: 4 },
  submitText: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 16 },
  permission: { flex: 1, padding: 28, justifyContent: 'center', gap: 16, backgroundColor: colors.paper },
  permissionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 34 },
  copy: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
});