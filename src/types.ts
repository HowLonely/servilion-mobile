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