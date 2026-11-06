import { describeConnection } from '../model/connection-view';

describe('describeConnection', () => {
  it('is live only when both hops are healthy', () => {
    expect(describeConnection('connected', 'connected')).toEqual({ tone: 'live', label: 'LIVE' });
    expect(describeConnection('connected', 'reconnecting')).toMatchObject({ tone: 'warn', label: 'DELAYED' });
  });

  it('explains reconnects with a retry hint', () => {
    expect(describeConnection('reconnecting', 'connected', 4200).detail).toContain('retrying in 4s');
  });

  it('reports offline and paused', () => {
    expect(describeConnection('offline', 'connected').tone).toBe('down');
    expect(describeConnection('paused', 'connected').tone).toBe('idle');
  });
});
