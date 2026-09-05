import { saveSession } from './session';
import type { CachedOrder, CachedRoom, DeliveryPayload, Page, Session, User } from './types';

type TokenResponse = { access: string; refresh: string; user: User };
type ApiResult<T> = { data: T; session: Session };
type ApiOrder = Omit<CachedOrder, 'server_id'> & { id: number };

function normalizeOrder(order: ApiOrder): CachedOrder {
  const { id, ...fields } = order;
  return { server_id: id, ...fields };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const detail = typeof body === 'object' && body !== null && 'detail' in body
    ? String((body as { detail: unknown }).detail)
    : `El servidor respondió ${response.status}.`;
  return new ApiError(detail, response.status, body);
}

export async function login(apiUrl: string, username: string, password: string): Promise<Session> {
  const normalizedUrl = normalizeApiUrl(apiUrl);
  const response = await fetch(`${normalizedUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  if (!response.ok) throw await parseError(response);

  const tokens = await response.json() as TokenResponse;
  const session = { apiUrl: normalizedUrl, ...tokens };
  await saveSession(session);
  return session;
}

async function refreshSession(session: Session): Promise<Session> {
  const response = await fetch(`${session.apiUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: session.refresh }),
  });
  if (!response.ok) throw await parseError(response);

  const tokens = await response.json() as TokenResponse;
  const refreshed = { apiUrl: session.apiUrl, ...tokens };
  await saveSession(refreshed);
  return refreshed;
}

export async function apiRequest<T>(
  session: Session,
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<ApiResult<T>> {
  const response = await fetch(`${session.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access}`,
      ...init.headers,
    },
  });

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshSession(session);
    return apiRequest<T>(refreshed, path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  return { data: await response.json() as T, session };
}

async function fetchAll<T>(session: Session, path: string): Promise<ApiResult<T[]>> {
  const items: T[] = [];
  let activeSession = session;
  let offset = 0;
  const limit = 100;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const result = await apiRequest<Page<T>>(activeSession, `${path}${separator}limit=${limit}&offset=${offset}`);
    activeSession = result.session;
    items.push(...result.data.items);
    offset += result.data.items.length;
    if (offset >= result.data.count || result.data.items.length === 0) break;
  }
  return { data: items, session: activeSession };
}

export async function fetchDeliveryCatalog(session: Session): Promise<{
  orders: CachedOrder[];
  rooms: CachedRoom[];
  session: Session;
}> {
  const ordersResult = await fetchAll<ApiOrder>(session, '/api/orders/?status=DESPACHADA');
  const roomsResult = await fetchAll<CachedRoom>(ordersResult.session, '/api/rooms/?is_active=true');
  return {
    orders: ordersResult.data.map(normalizeOrder),
    rooms: roomsResult.data,
    session: roomsResult.session,
  };
}

export async function fetchOrderByCode(session: Session, code: string): Promise<ApiResult<CachedOrder>> {
  const result = await apiRequest<ApiOrder>(session, `/api/orders/scan/${encodeURIComponent(code)}`);
  return { data: normalizeOrder(result.data), session: result.session };
}

export async function sendDelivery(session: Session, payload: DeliveryPayload): Promise<ApiResult<unknown>> {
  return apiRequest<unknown>(session, '/api/delivery/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}