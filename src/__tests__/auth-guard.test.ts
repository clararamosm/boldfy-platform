// Tests for auth-guard.ts — role-based access control
// These tests mock Firebase Admin SDK and validate that every guard
// correctly enforces role requirements.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin — use vi.hoisted() so mocks are available when vi.mock factory runs
const { mockVerifyIdToken, mockGet, mockDoc, mockCollection } = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn();
  const mockGet = vi.fn();
  const mockDoc = vi.fn(() => ({ get: mockGet }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  return { mockVerifyIdToken, mockGet, mockDoc, mockCollection };
});

vi.mock('@/lib/firebase-admin', () => ({
  auth: { verifyIdToken: mockVerifyIdToken },
  db: { collection: mockCollection },
}));

import {
  requireAuth,
  requireSelf,
  requireAdmin,
  requireMaster,
  requireStrategist,
  requireTLOrMaster,
  requireStrategistOrMaster,
  requireAdminOrStrategist,
} from '@/lib/auth-guard';

// ─── Helpers ──────────────────────────────────────────────────

function mockUser(role: string, companyId?: string, extra?: Record<string, unknown>) {
  mockVerifyIdToken.mockResolvedValue({ uid: 'user-123', email: 'test@boldfy.com' });
  mockGet.mockResolvedValue({
    exists: true,
    data: () => ({ role, companyId, profile: { name: 'Test User' }, ...extra }),
  });
}

// ─── requireAuth ──────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws if token is empty', async () => {
    await expect(requireAuth('')).rejects.toThrow('Token de autenticacao ausente');
  });

  it('returns user data for a valid token', async () => {
    mockUser('admin', 'company-1');
    const user = await requireAuth('valid-token');
    expect(user.uid).toBe('user-123');
    expect(user.role).toBe('admin');
    expect(user.companyId).toBe('company-1');
  });

  it('throws on invalid/expired token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
    await expect(requireAuth('bad-token')).rejects.toThrow('Sessao invalida');
  });
});

// ─── requireSelf ──────────────────────────────────────────────

describe('requireSelf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows user to access their own data', async () => {
    mockUser('colaborador');
    const user = await requireSelf('token', 'user-123');
    expect(user.uid).toBe('user-123');
  });

  it('blocks user from accessing other user data', async () => {
    mockUser('colaborador');
    await expect(requireSelf('token', 'other-user')).rejects.toThrow('Acesso negado');
  });
});

// ─── requireAdmin ─────────────────────────────────────────────

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows admin role', async () => {
    mockUser('admin', 'company-1');
    const user = await requireAdmin('token');
    expect(user.role).toBe('admin');
  });

  it('allows master role (master is super admin)', async () => {
    mockUser('master');
    const user = await requireAdmin('token');
    expect(user.role).toBe('master');
  });

  it('blocks colaborador role', async () => {
    mockUser('colaborador', 'company-1');
    await expect(requireAdmin('token')).rejects.toThrow('permissão de administrador');
  });

  it('blocks strategist role', async () => {
    mockUser('strategist');
    await expect(requireAdmin('token')).rejects.toThrow('permissão de administrador');
  });

  it('blocks admin from accessing another company', async () => {
    mockUser('admin', 'company-1');
    await expect(requireAdmin('token', 'company-2')).rejects.toThrow('não tem permissão nesta empresa');
  });

  it('allows admin in their own company', async () => {
    mockUser('admin', 'company-1');
    const user = await requireAdmin('token', 'company-1');
    expect(user.companyId).toBe('company-1');
  });
});

// ─── requireMaster ────────────────────────────────────────────

describe('requireMaster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows master role', async () => {
    mockUser('master');
    const user = await requireMaster('token');
    expect(user.role).toBe('master');
  });

  it('blocks admin role', async () => {
    mockUser('admin', 'company-1');
    await expect(requireMaster('token')).rejects.toThrow('permissão de master');
  });

  it('blocks colaborador role', async () => {
    mockUser('colaborador');
    await expect(requireMaster('token')).rejects.toThrow('permissão de master');
  });
});

// ─── requireStrategist ────────────────────────────────────────

describe('requireStrategist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows strategist role', async () => {
    mockUser('strategist');
    const user = await requireStrategist('token');
    expect(user.role).toBe('strategist');
  });

  it('blocks master role (strict strategist-only)', async () => {
    mockUser('master');
    await expect(requireStrategist('token')).rejects.toThrow('permissão de estrategista');
  });
});

// ─── requireTLOrMaster ────────────────────────────────────────

describe('requireTLOrMaster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows thoughtleader role', async () => {
    mockUser('thoughtleader', 'company-1');
    const user = await requireTLOrMaster('token');
    expect(user.role).toBe('thoughtleader');
  });

  it('allows master role', async () => {
    mockUser('master');
    const user = await requireTLOrMaster('token');
    expect(user.role).toBe('master');
  });

  it('blocks strategist role', async () => {
    mockUser('strategist');
    await expect(requireTLOrMaster('token')).rejects.toThrow('Thought Leader ou Master');
  });

  it('blocks admin role', async () => {
    mockUser('admin', 'company-1');
    await expect(requireTLOrMaster('token')).rejects.toThrow('Thought Leader ou Master');
  });
});

// ─── requireStrategistOrMaster ────────────────────────────────

describe('requireStrategistOrMaster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows strategist role', async () => {
    mockUser('strategist');
    const user = await requireStrategistOrMaster('token');
    expect(user.role).toBe('strategist');
  });

  it('allows master role', async () => {
    mockUser('master');
    const user = await requireStrategistOrMaster('token');
    expect(user.role).toBe('master');
  });

  it('blocks admin role', async () => {
    mockUser('admin', 'company-1');
    await expect(requireStrategistOrMaster('token')).rejects.toThrow('estrategista ou master');
  });

  it('blocks colaborador role', async () => {
    mockUser('colaborador');
    await expect(requireStrategistOrMaster('token')).rejects.toThrow('estrategista ou master');
  });
});

// ─── requireAdminOrStrategist ─────────────────────────────────

describe('requireAdminOrStrategist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows master (full access)', async () => {
    mockUser('master');
    const user = await requireAdminOrStrategist('token', 'any-company');
    expect(user.role).toBe('master');
  });

  it('allows admin for their company', async () => {
    mockUser('admin', 'company-1');
    const user = await requireAdminOrStrategist('token', 'company-1');
    expect(user.role).toBe('admin');
  });

  it('blocks admin for another company', async () => {
    mockUser('admin', 'company-1');
    await expect(requireAdminOrStrategist('token', 'company-2')).rejects.toThrow('não tem permissão');
  });

  it('blocks colaborador role entirely', async () => {
    mockUser('colaborador', 'company-1');
    await expect(requireAdminOrStrategist('token', 'company-1')).rejects.toThrow('admin ou estrategista');
  });
});
