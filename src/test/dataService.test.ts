import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normPhone } from '@/contexts/AppContext';

// Mock the supabase module so data service tests don't hit real DB
vi.mock('@/lib/supabase', () => {
  const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockEq = vi.fn().mockReturnValue({ select: mockSelect, maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), single: vi.fn().mockResolvedValue({ data: null, error: null }) });
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: mockEq, order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }), limit: vi.fn().mockResolvedValue({ data: [], error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }) }) }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });
  return {
    supabase: { from: mockFrom },
  };
});

describe('normPhone', () => {
  it('normalizes 07xx format to +256', () => {
    expect(normPhone('0701234567')).toBe('+256701234567');
  });

  it('normalizes 256 prefix without +', () => {
    expect(normPhone('256701234567')).toBe('+256701234567');
  });

  it('keeps +256 format unchanged', () => {
    expect(normPhone('+256701234567')).toBe('+256701234567');
  });

  it('strips spaces and dashes', () => {
    expect(normPhone('070-123-4567')).toBe('+256701234567');
    expect(normPhone('070 123 4567')).toBe('+256701234567');
    expect(normPhone('(070) 123-4567')).toBe('+256701234567');
  });

  it('prepends +256 to bare local numbers', () => {
    expect(normPhone('701234567')).toBe('+256701234567');
  });
});

describe('dataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can import dataService functions', async () => {
    const ds = await import('@/lib/dataService');
    expect(typeof ds.createGroup).toBe('function');
    expect(typeof ds.listGroups).toBe('function');
    expect(typeof ds.recordContribution).toBe('function');
    expect(typeof ds.listContributions).toBe('function');
    expect(typeof ds.applyLoan).toBe('function');
    expect(typeof ds.listLoans).toBe('function');
    expect(typeof ds.sendMessage).toBe('function');
    expect(typeof ds.listMessages).toBe('function');
    expect(typeof ds.initiateMoMoPayment).toBe('function');
    expect(typeof ds.updateContribution).toBe('function');
    expect(typeof ds.updateContributionStatus).toBe('function');
    expect(typeof ds.listRoscaCycles).toBe('function');
    expect(typeof ds.listRoscaDraws).toBe('function');
  });
});
