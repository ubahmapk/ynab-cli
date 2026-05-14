import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YnabCliError } from './errors.js';

vi.mock('@napi-rs/keyring', () => ({
  Entry: function () {
    return {
      getPassword: vi.fn().mockReturnValue('test-token'),
      setPassword: vi.fn(),
      deletePassword: vi.fn(),
    };
  },
}));

import { YnabClient } from './api-client.js';

describe('YnabClient.rawApiCall path validation', () => {
  let client: YnabClient;

  beforeEach(() => {
    client = new YnabClient();
  });

  // Path validation runs before getApi(), so these tests need no auth or network setup.

  it('rejects a path that does not start with /', async () => {
    await expect(client.rawApiCall('GET', 'budgets')).rejects.toBeInstanceOf(YnabCliError);
  });

  it('rejects an empty path', async () => {
    await expect(client.rawApiCall('GET', '')).rejects.toBeInstanceOf(YnabCliError);
  });

  it('rejects a path with a leading .. segment', async () => {
    await expect(client.rawApiCall('GET', '/../../../other')).rejects.toBeInstanceOf(YnabCliError);
  });

  it('rejects a path with an interior .. segment', async () => {
    await expect(
      client.rawApiCall('GET', '/budgets/../accounts')
    ).rejects.toBeInstanceOf(YnabCliError);
  });

  it('accepts a valid path and calls fetch with the correct URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      await client.rawApiCall('GET', '/user');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ynab.com/v1/user',
        expect.objectContaining({ method: 'GET' })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('substitutes and encodes the budget ID in {budget_id} paths', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      // Pass budget ID directly to bypass config lookup
      await client.rawApiCall('GET', '/budgets/{budget_id}/transactions', undefined, 'test-budget-uuid');
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/budgets/test-budget-uuid/transactions');
      expect(calledUrl).not.toContain('{budget_id}');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
