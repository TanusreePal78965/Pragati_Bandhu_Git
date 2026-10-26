import { fetchAllRows } from '../services/paging';

const source = (total: number) => {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { rows, calls, page };
};

describe('fetchAllRows', () => {
  it.each([
    [0, 1],
    [999, 1],
    [1000, 2],
    [1001, 2],
    [2500, 3],
  ])('returns all %i rows once each in %i calls', async (total, expectedCalls) => {
    const s = source(total);
    const result = await fetchAllRows(s.page);
    expect(result).toEqual(s.rows);
    expect(s.calls).toHaveLength(expectedCalls);
    expect(s.calls[0]).toEqual([0, 999]);
    if (expectedCalls > 1) expect(s.calls[1]).toEqual([1000, 1999]);
  });

  it('propagates an error from page 2', async () => {
    let n = 0;
    const page = async () => {
      n++;
      if (n === 2) return { data: null, error: { message: 'boom' } };
      return { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null };
    };
    await expect(fetchAllRows(page)).rejects.toEqual({ message: 'boom' });
  });
});
