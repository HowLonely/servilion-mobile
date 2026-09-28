import * as Location from 'expo-location';

export type PreciseLocation = { latitude: number; longitude: number; accuracy_meters: number };

/**
 * Ubicación precisa para dejar evidencia de un registro en terreno.
 *
 * Es obligatoria en las entregas y en los movimientos de lencería: sin permiso,
 * sin GPS activo o sin una precisión informada, el registro no se guarda.
 */
export async function getPreciseLocation(): Promise<PreciseLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('La ubicación precisa es obligatoria para registrar en terreno.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Activa la ubicación del teléfono para continuar.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  if (!position.coords.accuracy || position.coords.accuracy <= 0) {
    throw new Error('No fue posible obtener la precisión de la ubicación. Inténtalo nuevamente.');
  }
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy_meters: position.coords.accuracy,
  };
}
