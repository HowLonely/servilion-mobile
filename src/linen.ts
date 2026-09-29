import type {
  LinenCompanyBalance,
  LinenMovementRecord,
  StoredLinenLine,
} from './types';

/**
 * Saldo de hotelería que ve el supervisor en faena, sin señal.
 *
 * El teléfono guarda el último saldo que bajó del servidor y, encima, aplica
 * lo que registró él mismo y el servidor todavía no tiene: así, después de
 * repartir 10 sábanas sin señal, el campamento ya muestra 10 más.
 *
 * Qué movimientos locales se aplican:
 * - Los que aún no se envían (PENDING, FAILED): el servidor no los tiene.
 * - Los enviados DESPUÉS de la última descarga: el servidor ya los tiene,
 *   pero el saldo guardado es anterior y no los incluye.
 * Los enviados antes de la descarga ya vienen dentro de ella; aplicarlos otra
 * vez los contaría dos veces. Los REJECTED no cuentan: el servidor no los
 * registró.
 */
export function pendingEffect(
  movement: LinenMovementRecord,
  snapshotAt: string | null,
): boolean {
  if (movement.state === 'PENDING' || movement.state === 'FAILED') return true;
  if (movement.state !== 'SYNCED') return false;
  if (!snapshotAt || !movement.synced_at) return true;
  return movement.synced_at > snapshotAt;
}

export function parseLines(linesJson: string): StoredLinenLine[] {
  try {
    const parsed = JSON.parse(linesJson) as StoredLinenLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Piezas de cada tipo que hay en un campamento según el teléfono.
 *
 * Devuelve un mapa tipo → cantidad. Puede ser negativo: se retiró más de lo
 * que el sistema tenía registrado, y eso se muestra, no se corrige aquí.
 */
export function campBalance(
  company: LinenCompanyBalance,
  campId: number,
  movements: LinenMovementRecord[],
  snapshotAt: string | null,
): Map<number, number> {
  const balance = new Map<number, number>();
  for (const type of company.linen_types) balance.set(type.id, 0);

  const row = company.locations.find(
    (location) => location.kind === 'CAMPAMENTO' && location.camp_id === campId,
  );
  for (const line of row?.lines ?? []) balance.set(line.garment_type_id, line.quantity);

  for (const movement of movements) {
    if (movement.company_id !== company.company_id || movement.camp_id !== campId) continue;
    if (!pendingEffect(movement, snapshotAt)) continue;
    const sign = movement.kind === 'REPARTO' ? 1 : -1;
    for (const line of parseLines(movement.lines_json)) {
      balance.set(line.garment_type_id, (balance.get(line.garment_type_id) ?? 0) + sign * line.quantity);
    }
  }
  return balance;
}

export function totalOf(balance: Map<number, number>): number {
  let total = 0;
  for (const quantity of balance.values()) total += quantity;
  return total;
}

/** Campamentos del cliente a los que se puede repartir o de los que se retira. */
export function campsOf(company: LinenCompanyBalance): { id: number; name: string }[] {
  return company.locations
    .filter((location) => location.kind === 'CAMPAMENTO' && location.camp_id !== null)
    .map((location) => ({ id: location.camp_id as number, name: location.name }));
}
