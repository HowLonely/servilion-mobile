export type DeliveryFlow = 'FLUJO_1' | 'FLUJO_2';

export type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
};

export type Session = {
  apiUrl: string;
  access: string;
  refresh: string;
  user: User;
};

export type CachedOrder = {
  server_id: number;
  order_number: string | null;
  reference: string;
  control_code: string;
  worker_name: string;
  company_name: string;
  client_name: string;
  delivery_flow: DeliveryFlow;
  status: string;
  delivery_room_id: number | null;
  room_number: string;
  camp_name: string;
  updated_at: string;
};

export type CachedRoom = {
  id: number;
  camp_id: number;
  camp_name: string;
  faena_id: number;
  number: string;
  qr_code: string;
  is_active: boolean;
};

export type DeliveryState = 'PENDING' | 'FAILED' | 'SYNCED';

export type DeliveryRecord = {
  client_uuid: string;
  order_server_id: number;
  order_code: string;
  worker_name: string;
  company_name: string;
  delivery_flow: DeliveryFlow;
  room_qr: string | null;
  scanned_room_label: string | null;
  confirm_different_room: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  delivered_at: string;
  note: string;
  state: DeliveryState;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
};

export type Page<T> = { items: T[]; count: number };

export type DeliveryPayload = {
  client_uuid: string;
  order_code: string;
  room_qr?: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  delivered_at: string;
  note: string;
  confirm_different_room: boolean;
};
// --- Hotelería ---------------------------------------------------------------
//
// La lencería de hotelería es un stock del cliente que rota entre la planta y
// sus campamentos. Desde esta app se registran los dos movimientos que ocurren
// en faena: el REPARTO de lo limpio a un campamento y el RETIRO del sucio.

export type LinenKind = 'REPARTO' | 'RETIRO';

export type LinenType = { id: number; code: string; name: string };

export type LinenBalanceLine = { garment_type_id: number; quantity: number };

/** Una fila del saldo del servidor (`BalanceLocationOut`). */
export type LinenLocation = {
  kind: 'SERVILION' | 'BODEGA_FAENA' | 'CAMPAMENTO';
  camp_id: number | null;
  name: string;
  lines: LinenBalanceLine[];
  total: number;
  has_negative: boolean;
  last_counted_at: string | null;
};

/** Saldo de un cliente de hotelería tal como lo entrega `/api/hospitality/balances`. */
export type LinenCompanyBalance = {
  company_id: number;
  company_name: string;
  faena_name: string;
  linen_types: LinenType[];
  locations: LinenLocation[];
};

export type LinenLine = { garment_type_id: number; quantity: number };

/**
 * Estado de un movimiento en la cola del teléfono.
 *
 * REJECTED es distinto de FAILED: el servidor lo rechazó por una regla del
 * negocio (campamento ajeno, tipo que ya no es de hotelería) y reintentarlo no
 * lo va a arreglar. FAILED es un problema de red y se reintenta solo.
 */
export type LinenMovementState = 'PENDING' | 'FAILED' | 'SYNCED' | 'REJECTED';

export type LinenMovementRecord = {
  client_uuid: string;
  kind: LinenKind;
  company_id: number;
  company_name: string;
  camp_id: number;
  camp_name: string;
  /** JSON de `LinenLine[]`, con el nombre de cada tipo para el historial. */
  lines_json: string;
  total_quantity: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  occurred_at: string;
  note: string;
  state: LinenMovementState;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
};

export type StoredLinenLine = LinenLine & { name: string };

export type LinenMovementPayload = {
  client_uuid: string;
  kind: LinenKind;
  company_id: number;
  camp_id: number;
  lines: LinenLine[];
  occurred_at: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  note: string;
};

export type LinenSyncResult = {
  client_uuid: string;
  status: 'CREADO' | 'DUPLICADO' | 'ERROR';
  movement_id: number | null;
  detail: string;
};
