import { filterPairs, matchesQuery, mergePairLists } from '../model/filter-pairs';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];

describe('matchesQuery', () => {
  it.each(['btc', 'BTC', 'BTC/USDT', 'btc usdt', 'btcu', ''])('matches BTCUSDT for "%s"', (q) => {
    expect(matchesQuery('BTCUSDT', q)).toBe(true);
  });
  it('rejects non-matches', () => {
    expect(matchesQuery('BTCUSDT', 'eth')).toBe(false);
  });
});

describe('filterPairs', () => {
  it('filters by query', () => {
    expect(filterPairs(PAIRS, [], { query: 'do', favouritesOnly: false })).toEqual(['DOGEUSDT']);
    expect(filterPairs(PAIRS, [], { query: 'usdt', favouritesOnly: false })).toHaveLength(5);
  });
  it('pins favourites first and supports favourites-only', () => {
    expect(filterPairs(PAIRS, ['XRPUSDT'], { query: '', favouritesOnly: false })[0]).toBe('XRPUSDT');
    expect(filterPairs(PAIRS, ['XRPUSDT', 'SOLUSDT'], { query: '', favouritesOnly: true })).toEqual(['SOLUSDT', 'XRPUSDT']);
  });
});

describe('mergePairLists', () => {
  it('unions while preserving first-seen order', () => {
    expect(mergePairLists(['A', 'B'], ['B', 'C'], ['A'])).toEqual(['A', 'B', 'C']);
  });
});
