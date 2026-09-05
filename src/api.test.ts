import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./session', () => ({ saveSession: vi.fn() }));

let ApiError: typeof import('./api').ApiError;
let normalizeApiUrl: typeof import('./api').normalizeApiUrl;

beforeAll(async () => {
  ({ ApiError, normalizeApiUrl } = await import('./api'));
});

describe('mobile API helpers', () => {
  it('normalizes configured backend URLs', () => {
    expect(normalizeApiUrl('  api.servilion.cl/// ')).toBe('http://api.servilion.cl');
    expect(normalizeApiUrl('HTTPS://api.servilion.cl/')).toBe('HTTPS://api.servilion.cl');
  });

  it('keeps HTTP diagnostics in API errors', () => {
    const body = { detail: 'Sesión vencida' };
    const error = new ApiError('Sesión vencida', 401, body);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(401);
    expect(error.body).toBe(body);
  });
});