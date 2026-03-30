import { describe, it, expect } from 'vitest';
import {
  formatUGX,
  getStatusColor,
  getPaymentMethodLabel,
  getRoleColor,
  getGroupTypeLabel,
  getGroupTypeColor,
  type PaymentMethod,
  type UserRole,
  type GroupType,
} from '@/lib/constants';

describe('formatUGX', () => {
  it('formats positive amounts with UGX prefix', () => {
    expect(formatUGX(50000)).toBe('UGX 50,000');
  });

  it('formats zero', () => {
    expect(formatUGX(0)).toBe('UGX 0');
  });

  it('formats large amounts', () => {
    expect(formatUGX(5000000)).toBe('UGX 5,000,000');
  });
});

describe('getStatusColor', () => {
  it('returns emerald for confirmed', () => {
    expect(getStatusColor('confirmed')).toBe('bg-emerald-100 text-emerald-700');
  });

  it('returns amber for pending', () => {
    expect(getStatusColor('pending')).toBe('bg-amber-100 text-amber-700');
  });

  it('returns red for failed', () => {
    expect(getStatusColor('failed')).toBe('bg-red-100 text-red-700');
  });

  it('returns gray for unknown', () => {
    expect(getStatusColor('unknown')).toBe('bg-gray-100 text-gray-700');
  });
});

describe('getPaymentMethodLabel', () => {
  it('returns correct labels', () => {
    expect(getPaymentMethodLabel('mtn_momo' as PaymentMethod)).toBe('MTN MoMo');
    expect(getPaymentMethodLabel('airtel_money' as PaymentMethod)).toBe('Airtel Money');
    expect(getPaymentMethodLabel('cash' as PaymentMethod)).toBe('Cash');
    expect(getPaymentMethodLabel('bank_transfer' as PaymentMethod)).toBe('Bank Transfer');
  });
});

describe('getRoleColor', () => {
  it('returns correct colors for each role', () => {
    expect(getRoleColor('admin' as UserRole)).toBe('bg-purple-100 text-purple-700');
    expect(getRoleColor('treasurer' as UserRole)).toBe('bg-blue-100 text-blue-700');
    expect(getRoleColor('chairperson' as UserRole)).toBe('bg-emerald-100 text-emerald-700');
    expect(getRoleColor('member' as UserRole)).toBe('bg-gray-100 text-gray-600');
  });
});

describe('getGroupTypeLabel', () => {
  it('returns correct labels', () => {
    expect(getGroupTypeLabel('savings_club' as GroupType)).toBe('Savings Club');
    expect(getGroupTypeLabel('investment_club' as GroupType)).toBe('Investment Club');
    expect(getGroupTypeLabel('sacco' as GroupType)).toBe('SACCO');
    expect(getGroupTypeLabel('rosca' as GroupType)).toBe('ROSCA');
    expect(getGroupTypeLabel('hybrid' as GroupType)).toBe('Hybrid');
  });
});

describe('getGroupTypeColor', () => {
  it('returns correct colors', () => {
    expect(getGroupTypeColor('savings_club' as GroupType)).toBe('bg-emerald-100 text-emerald-700');
    expect(getGroupTypeColor('rosca' as GroupType)).toBe('bg-amber-100 text-amber-700');
  });
});
