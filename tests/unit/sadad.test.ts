import { describe, expect, it } from 'vitest';
import { isSadadFailed, isSadadPaid, sadadTransactionStatus } from '@/lib/sadad';

describe('sadadTransactionStatus', () => {
  it('reads official snake_case status values', () => {
    expect(sadadTransactionStatus({ transaction_status: '1' })).toBe('1');
    expect(sadadTransactionStatus({ transaction_status: '2' })).toBe('2');
    expect(sadadTransactionStatus({ transaction_status: '3' })).toBe('3');
  });

  it('reads callback field variants used by SADAD/webhooks', () => {
    expect(sadadTransactionStatus({ transactionStatus: '2' })).toBe('2');
    expect(sadadTransactionStatus({ TransactionStatus: '3' })).toBe('3');
  });
});

describe('SADAD status classification', () => {
  it('treats status 1 as pending, not failed', () => {
    const payload = { transaction_status: '1', STATUS: 'PENDING' };
    expect(isSadadPaid(payload)).toBe(false);
    expect(isSadadFailed(payload)).toBe(false);
  });

  it('treats status 2 as failed', () => {
    expect(isSadadFailed({ transactionStatus: '2', RESPMSG: 'Authentication failed' })).toBe(true);
  });

  it('treats status 3 as paid', () => {
    expect(isSadadPaid({ transaction_status: '3', STATUS: 'TXN_SUCCESS' })).toBe(true);
  });
});
