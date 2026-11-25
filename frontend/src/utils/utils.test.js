import { NEXT_STATUS, formatINR, lineKey, toPaise } from './index';

describe('utils', () => {
  it('formats paise as INR', () => {
    expect(formatINR(24900)).toContain('249');
    expect(formatINR(24950)).toContain('249.50');
  });
  it('converts rupees to integer paise without float drift', () => {
    expect(toPaise('19.99')).toBe(1999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
  it('builds stable cart line keys independent of option order', () => {
    const a = lineKey('p1', [{ groupId: 'g1', choiceId: 'c1' }, { groupId: 'g2', choiceId: 'c2' }]);
    const b = lineKey('p1', [{ groupId: 'g2', choiceId: 'c2' }, { groupId: 'g1', choiceId: 'c1' }]);
    expect(a).toBe(b);
  });
  it('advances delivery and pickup flows differently', () => {
    expect(NEXT_STATUS({ orderType: 'delivery', orderStatus: 'ready' })).toBe('out_for_delivery');
    expect(NEXT_STATUS({ orderType: 'pickup', orderStatus: 'ready' })).toBe('picked_up');
    expect(NEXT_STATUS({ orderType: 'pickup', orderStatus: 'picked_up' })).toBeNull();
  });
});
