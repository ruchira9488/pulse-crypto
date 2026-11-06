import { computeDepthCurve, liquidityGap, pressureLabel } from '../model/depth-curve';

describe('computeDepthCurve', () => {
  const bids: [number, number][] = [
    [100, 1],
    [99, 2],
    [98, 3],
  ];
  const asks: [number, number][] = [
    [101, 1],
    [102, 1],
    [103, 1],
  ];

  it('returns a fixed number of points per side', () => {
    const c = computeDepthCurve(bids, asks, 10);
    expect(c.bids).toHaveLength(10);
    expect(c.asks).toHaveLength(10);
  });

  it('is cumulative and normalised to the deeper side', () => {
    const c = computeDepthCurve(bids, asks, 3);
    expect(c.bidTotal).toBe(6);
    expect(c.askTotal).toBe(3);
    // bids: far end (left) is the full cumulative depth, centre is the best level only
    expect(c.bids).toEqual([1, 0.5, 1 / 6]);
    expect(c.asks).toEqual([1 / 6, 2 / 6, 3 / 6]);
  });

  it('handles an empty book', () => {
    const c = computeDepthCurve([], asks, 4);
    expect(c.bids).toEqual([0, 0, 0, 0]);
  });
});

describe('labels', () => {
  it('classifies liquidity gap and pressure', () => {
    expect(liquidityGap(0.02)).toBe('Low');
    expect(liquidityGap(0.1)).toBe('Medium');
    expect(liquidityGap(0.5)).toBe('High');
    expect(pressureLabel(70)).toBe('Buy Heavy');
    expect(pressureLabel(30)).toBe('Sell Heavy');
    expect(pressureLabel(50)).toBe('Balanced');
  });
});
