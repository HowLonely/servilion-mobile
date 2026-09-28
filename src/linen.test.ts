import { describe, expect, it } from 'vitest';

import { campBalance, campsOf, pendingEffect, totalOf } from './linen';
import type { LinenCompanyBalance, LinenMovementRecord } from './types';

const SHEET = 1;
const TOWEL = 2;

const company: LinenCompanyBalance = {
  company_id: 10,
  company_name: 'Hotel Cordillera',
  faena_name: 'Faena Horizonte',
  linen_types: [
    { id: SHEET, code: 'SAB', name: 'Sábana' },
    { id: TOWEL, code: 'TOA', name: 'Toalla' },
  ],
  locations: [
    { kind: 'SERVILION', camp_id: null, name: 'En poder de Servilion', lines: [], total: 0, has_negative: false, last_counted_at: null },
    { kind: 'BODEGA_FAENA', camp_id: null, name: 'Por repartir en faena', lines: [], total: 0, has_negative: false, last_counted_at: null },
    {
      kind: 'CAMPAMENTO', camp_id: 5, name: 'Campamento Central',
      lines: [{ garment_type_id: SHEET, quantity: 40 }, { garment_type_id: TOWEL, quantity: 20 }],
      total: 60, has_negative: false, last_counted_at: null,
    },
  ],
};

function movement(overrides: Partial<LinenMovementRecord>): LinenMovementRecord {
  return {
    client_uuid: 'uuid',
    kind: 'REPARTO',
    company_id: 10,
    company_name: 'Hotel Cordillera',
    camp_id: 5,
    camp_name: 'Campamento Central',
    lines_json: JSON.stringify([{ garment_type_id: SHEET, quantity: 10, name: 'Sábana' }]),
    total_quantity: 10,
    latitude: -23.6,
    longitude: -70.4,
    accuracy_meters: 5,
    occurred_at: '2026-09-28T10:00:00.000Z',
    note: '',
    state: 'PENDING',
    attempt_count: 0,
    last_error: null,
    created_at: '2026-09-28T10:00:00.000Z',
    synced_at: null,
    ...overrides,
  };
}

const SNAPSHOT = '2026-09-28T12:00:00.000Z';

describe('saldo local de lencería', () => {
  it('parte del saldo descargado', () => {
    const balance = campBalance(company, 5, [], SNAPSHOT);
    expect(balance.get(SHEET)).toBe(40);
    expect(totalOf(balance)).toBe(60);
  });

  it('suma los repartos y resta los retiros que el servidor todavía no tiene', () => {
    const balance = campBalance(company, 5, [
      movement({ kind: 'REPARTO', state: 'PENDING' }),
      movement({
        kind: 'RETIRO',
        state: 'FAILED',
        lines_json: JSON.stringify([{ garment_type_id: TOWEL, quantity: 25, name: 'Toalla' }]),
      }),
    ], SNAPSHOT);

    expect(balance.get(SHEET)).toBe(50);
    // Se retiró más de lo registrado: se muestra el negativo, no se corrige.
    expect(balance.get(TOWEL)).toBe(-5);
  });

  it('no cuenta dos veces lo que ya venía en la descarga', () => {
    const syncedBefore = movement({ state: 'SYNCED', synced_at: '2026-09-28T11:00:00.000Z' });
    const syncedAfter = movement({ state: 'SYNCED', synced_at: '2026-09-28T13:00:00.000Z' });

    expect(pendingEffect(syncedBefore, SNAPSHOT)).toBe(false);
    expect(pendingEffect(syncedAfter, SNAPSHOT)).toBe(true);
    expect(campBalance(company, 5, [syncedBefore, syncedAfter], SNAPSHOT).get(SHEET)).toBe(50);
  });

  it('ignora los rechazados y los de otro campamento', () => {
    const balance = campBalance(company, 5, [
      movement({ state: 'REJECTED' }),
      movement({ camp_id: 99 }),
    ], SNAPSHOT);
    expect(balance.get(SHEET)).toBe(40);
  });

  it('lista solo los campamentos como destinos', () => {
    expect(campsOf(company)).toEqual([{ id: 5, name: 'Campamento Central' }]);
  });
});
