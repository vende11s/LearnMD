import assert from 'node:assert/strict';
import { before, test, type TestContext } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  isShareExpired,
  readBoundedBody,
  utcMonthWindow,
} from '../src/runtime.js';
import { MAX_SHARE_BYTES, SHARE_TTL_MS } from '../../shared/share-contract.js';

let script: string;
before(async () => {
  const result = await build({
    entryPoints: ['test/fixture-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    external: ['cloudflare:workers'],
  });
  script = result.outputFiles[0].text;
});
const origin = 'http://127.0.0.1:5173';
const bundle = {
  format: 'learnmd-share',
  version: 1,
  kind: 'note',
  title: 'Example',
  notes: [{ id: 'n1', source: '# Example' }],
  folders: [],
  assets: [],
};
const body = JSON.stringify(bundle);
const size = new TextEncoder().encode(body).byteLength;
async function setup(
  t: TestContext,
  overrides: Record<string, string> = {},
  burst = 1000,
  verification: Record<string, unknown> = { success: false },
  createIdentity = true,
) {
  let verificationCalls = 0;
  const mf = new Miniflare({
    ...convertV4MiniflareOptions({
      name: 'test-sharing',
      modules: true,
      script,
      compatibilityDate: '2026-10-01',
      outboundService: async (request) => {
        verificationCalls++;
        assert.equal(
          request.url,
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        );
        const form = new URLSearchParams(await request.text());
        assert.equal(form.get('secret'), 'production-secret');
        return new Response(JSON.stringify(verification), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
      bindings: {
        ENVIRONMENT: 'local',
        ALLOWED_ORIGINS: origin,
        TURNSTILE_HOSTNAMES: '127.0.0.1',
        ...overrides,
      },
      r2Buckets: ['SHARES'],
      durableObjects: {
        SHARE_COORDINATOR: { className: 'ShareCoordinator', useSQLite: true },
      },
      ratelimits: Object.fromEntries(
        ['UPLOAD', 'READ', 'DELETE', 'SESSION'].map((name, i) => [
          `${name}_RATE_LIMITER`,
          {
            namespace_id: String(i + 1),
            simple: { limit: burst, period: 60 as const },
          },
        ]),
      ),
    }),
    unsafeInspectDurableObjects: true,
  });
  t.after(() => mf.dispose());
  let clientToken = '';
  const request = (
    path = '/shares',
    method = 'POST',
    data: string | undefined = method === 'POST' && path === '/shares'
      ? body
      : undefined,
    extra: Record<string, string> = {},
  ) =>
    mf.dispatchFetch(`http://localhost${path}`, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Turnstile-Token': 'local-development',
        'CF-Connecting-IP': '192.0.2.1',
        Connection: 'close',
        ...((method === 'GET' || (method === 'POST' && path === '/shares')) &&
        clientToken
          ? { 'X-Share-Client': clientToken }
          : {}),
        ...extra,
      },
      body: data,
    });
  const session = async (extra: Record<string, string> = {}) => {
    const response = await request('/session', 'POST', undefined, extra);
    assert.equal(response.status, 201, await response.clone().text());
    return ((await response.json()) as { token: string }).token;
  };
  if (createIdentity) clientToken = await session();
  const upload = async (extra: Record<string, string> = {}) => {
    const response = await request('/shares', 'POST', body, extra);
    assert.equal(response.status, 201, await response.clone().text());
    return response.json() as Promise<{
      id: string;
      createdAt: number;
      expiresAt: number;
      deleteToken: string;
    }>;
  };
  const sql = () =>
    mf.unsafeGetDurableObjectStorage('test-sharing', 'ShareCoordinator', {
      name: 'admission-v1',
    });
  const coordinator = async () => {
    const namespace = await mf.getDurableObjectNamespace('SHARE_COORDINATOR');
    return namespace.get(namespace.idFromName('admission-v1')) as unknown as {
      runCleanupForTest(): Promise<void>;
      changeLimitsForTest(overrides: Record<string, string>): Promise<void>;
      reconstructForTest(): Promise<number>;
      releasePutForTest(): Promise<void>;
      fetch(request: Request): Promise<Response>;
    };
  };
  return {
    mf,
    request,
    upload,
    sql,
    session,
    clientToken,
    verificationCalls: () => verificationCalls,
    coordinator,
  };
}

test('uploads a copy, returns exactly seven days and stores only the removal token hash', async (t) => {
  const { request, upload, sql, mf } = await setup(t);
  const share = await upload();
  assert.match(share.id, /^[A-Za-z0-9_-]{32}$/);
  assert.match(share.deleteToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(share.expiresAt - share.createdAt, SHARE_TTL_MS);
  const response = await request(`/shares/${share.id}`, 'GET');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), body);
  assert.equal(
    response.headers.get('X-Share-Expires-At'),
    String(share.expiresAt),
  );
  assert.equal(
    response.headers.get('X-Share-Created-At'),
    String(share.createdAt),
  );
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  const rows = await (await sql()).exec('SELECT * FROM shares');
  assert.notEqual(rows[0].delete_hash, share.deleteToken);
  assert.equal(String(rows[0].delete_hash).length, 64);
  const bucket = await mf.getR2Bucket('SHARES');
  assert.equal((await bucket.get(`shares/${share.id}`))?.size, size);
});

test('expiry boundary is exclusive and expired shares cannot be downloaded before cleanup', async (t) => {
  assert.equal(isShareExpired(999, 1000), false);
  assert.equal(isShareExpired(1000, 1000), true);
  assert.equal(isShareExpired(1001, 1000), true);
  const { request, upload, sql } = await setup(t);
  const share = await upload();
  await (
    await sql()
  ).exec('UPDATE shares SET expires_at=? WHERE id=?', Date.now() - 1, share.id);
  const response = await request(`/shares/${share.id}`, 'GET');
  assert.equal(response.status, 410);
  assert.equal(((await response.json()) as { error: string }).error, 'expired');
});

test('removal requires the secret, revokes download, and releases storage exactly once', async (t) => {
  const { request, upload, sql } = await setup(t);
  const share = await upload();
  const path = `/shares/${share.id}`;
  assert.equal((await request(path, 'DELETE')).status, 401);
  assert.equal(
    (
      await request(path, 'DELETE', undefined, {
        Authorization: `Bearer ${'a'.repeat(43)}`,
      })
    ).status,
    403,
  );
  assert.equal((await request(path, 'GET')).status, 200);
  assert.equal(
    (
      await request(path, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
  assert.equal((await request(path, 'GET')).status, 404);
  assert.equal(
    (
      await request(path, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    404,
  );
  const rows = await (
    await sql()
  ).exec(`SELECT value FROM metadata WHERE key='stored_bytes'`);
  assert.equal(rows[0].value, '0');
});

test('private API uses exact origins and exposes expiry/retry headers', async (t) => {
  const { request, mf } = await setup(t);
  const blocked = await request('/shares', 'POST', body, {
    Origin: `${origin}.evil.example`,
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.has('Access-Control-Allow-Origin'), false);
  const absent = await mf.dispatchFetch('http://localhost/shares', {
    method: 'POST',
    body,
  });
  assert.equal(absent.status, 403);
  const preflight = await request('/shares', 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.match(
    preflight.headers.get('Access-Control-Allow-Headers')!,
    /X-Turnstile-Token/,
  );
  assert.match(
    preflight.headers.get('Access-Control-Allow-Headers')!,
    /X-Share-Client/,
  );
  assert.equal((await request('/session', 'OPTIONS')).status, 204);
  assert.match(
    preflight.headers.get('Access-Control-Expose-Headers')!,
    /Retry-After/,
  );
});

test('production cannot use the local challenge bypass even with an allowed origin', async (t) => {
  const { request } = await setup(t, {
    ENVIRONMENT: 'production',
    TURNSTILE_SECRET: 'production-secret',
  });
  const response = await request('/shares', 'POST', body, {
    'X-Turnstile-Token': '',
  });
  assert.equal(response.status, 403);
  const error = (await response.json()) as { error: string };
  assert.equal(error.error, 'challenge_required');
  const bypass = await request();
  assert.equal(bypass.status, 403);
  assert.equal(
    ((await bypass.json()) as { error: string }).error,
    'challenge_failed',
  );
});

test('missing or altered browser identities fail before consuming a Turnstile proof', async (t) => {
  const { request, clientToken, verificationCalls } = await setup(
    t,
    { ENVIRONMENT: 'production', TURNSTILE_SECRET: 'production-secret' },
    1000,
    { success: true, hostname: '127.0.0.1', action: 'share-upload' },
  );
  const altered =
    clientToken.slice(0, -1) + (clientToken.endsWith('a') ? 'b' : 'a');
  for (const token of [
    '',
    altered,
    `v1.${'a'.repeat(32)}.${clientToken.split('.')[2]}`,
  ]) {
    const response = await request('/shares', 'POST', body, {
      'X-Share-Client': token,
      'X-Turnstile-Token': 'one-use-proof',
    });
    assert.equal(response.status, 401);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      'invalid_client',
    );
  }
  assert.equal(verificationCalls(), 0);
  const shareResponse = await request('/shares', 'POST', body, {
    'X-Turnstile-Token': 'one-use-proof',
  });
  assert.equal(shareResponse.status, 201);
  assert.equal(verificationCalls(), 1);
  const share = (await shareResponse.json()) as {
    id: string;
    deleteToken: string;
  };
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'GET', undefined, {
        'X-Share-Client': altered,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'GET', undefined, {
        'X-Share-Client': '',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
});

test('anonymous sessions need neither body nor Turnstile, are signed, and have a bounded global issuance budget', async (t) => {
  const { request, clientToken, sql, verificationCalls } = await setup(t, {
    ENVIRONMENT: 'production',
    SESSIONS_GLOBAL_DAY: '1',
  });
  assert.match(clientToken, /^v1\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(verificationCalls(), 0);
  const rejected = await request('/session', 'POST', undefined, {
    'CF-Connecting-IP': '192.0.2.9',
  });
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get('Retry-After')) > 0);
  assert.equal(
    (
      await (
        await sql()
      ).exec('SELECT count FROM counters WHERE key LIKE ?', 'session:global:%')
    )[0].count,
    1,
  );
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    0,
  );
  const stored = JSON.stringify(
    await (await sql()).exec('SELECT * FROM metadata'),
  );
  assert.equal(stored.includes(clientToken), false);
  assert.equal((await request('/session', 'POST', '{}')).status, 400);
});

test('the session IP burst limiter is independent of other operation limiters', async (t) => {
  const { request, upload } = await setup(t, {}, 1);
  const limited = await request('/session', 'POST');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  await upload();
});

test('browsers on the same IP have independent read budgets and changing IP preserves the client budget', async (t) => {
  const { request, upload, session } = await setup(t, {
    READS_PER_CLIENT_DAY: '1',
  });
  const share = await upload();
  const path = `/shares/${share.id}`;
  assert.equal((await request(path, 'GET')).status, 200);
  assert.equal(
    (
      await request(path, 'GET', undefined, {
        'CF-Connecting-IP': '192.0.2.99',
      })
    ).status,
    429,
  );
  const second = await session();
  assert.equal(
    (await request(path, 'GET', undefined, { 'X-Share-Client': second }))
      .status,
    200,
  );
});

test('per-browser byte budgets remain separate behind one IP', async (t) => {
  const { request, upload, session } = await setup(t, {
    UPLOAD_BYTES_PER_CLIENT_DAY: String(size),
    READ_BYTES_PER_CLIENT_DAY: String(size),
  });
  const share = await upload();
  assert.equal((await request()).status, 429);
  const path = `/shares/${share.id}`;
  assert.equal((await request(path, 'GET')).status, 200);
  assert.equal((await request(path, 'GET')).status, 429);
  const second = await session();
  await upload({ 'X-Share-Client': second });
  assert.equal(
    (await request(path, 'GET', undefined, { 'X-Share-Client': second }))
      .status,
    200,
  );
});

test('server verifies the Turnstile hostname and action, not just success', async (t) => {
  for (const [hostname, action, status] of [
    ['wrong.example', 'share-upload', 403],
    ['127.0.0.1', 'wrong-action', 403],
    ['127.0.0.1', 'share-upload', 201],
  ] as const) {
    const { request } = await setup(
      t,
      { ENVIRONMENT: 'production', TURNSTILE_SECRET: 'production-secret' },
      1000,
      { success: true, hostname, action },
    );
    assert.equal(
      (
        await request('/shares', 'POST', body, {
          'X-Turnstile-Token': 'verified-token',
        })
      ).status,
      status,
    );
  }
});

test('Turnstile accepts only boolean success true for the production hostname and action', async (t) => {
  const verification: Record<string, unknown> = {
    success: true,
    hostname: 'vende11s.github.io',
    action: 'share-upload',
  };
  const { request, sql } = await setup(
    t,
    {
      ENVIRONMENT: 'production',
      TURNSTILE_SECRET: 'production-secret',
      TURNSTILE_HOSTNAMES: 'vende11s.github.io',
    },
    1000,
    verification,
  );
  for (const success of [
    true,
    false,
    'true',
    'false',
    1,
    {},
    [],
    null,
    undefined,
  ]) {
    verification.success = success;
    const response = await request('/shares', 'POST', body, {
      'X-Turnstile-Token': 'mock-verification-token',
    });
    assert.equal(response.status, success === true ? 201 : 403);
    if (success !== true)
      assert.equal(
        ((await response.json()) as { error: string }).error,
        'challenge_failed',
      );
  }
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    1,
  );
});

test('location burst limits return structured 429 and Retry-After', async (t) => {
  const { request, upload } = await setup(t, {}, 1);
  await upload();
  const response = await request();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(
    ((await response.json()) as { error: string }).error,
    'rate_limited',
  );
});

test('global admission cannot be bypassed by changing browser token and IP', async (t) => {
  const { request, upload, sql, session } = await setup(t, {
    UPLOADS_GLOBAL_DAY: '1',
  });
  await upload();
  const otherClient = await session({ 'CF-Connecting-IP': '192.0.2.2' });
  const response = await request('/shares', 'POST', body, {
    'CF-Connecting-IP': '192.0.2.2',
    'X-Share-Client': otherClient,
  });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    1,
  );
});

test('browsers on the same IP have independent upload quotas, while changing IP does not reset a browser quota', async (t) => {
  const { request, upload, session } = await setup(t, {
    UPLOADS_PER_CLIENT_DAY: '1',
    UPLOAD_BYTES_PER_CLIENT_DAY: String(size * 3),
  });
  await upload();
  assert.equal((await request()).status, 429);
  assert.equal(
    (
      await request('/shares', 'POST', body, {
        'CF-Connecting-IP': '192.0.2.3',
      })
    ).status,
    429,
  );
  await upload({ 'X-Share-Client': await session() });
});

test('malformed uploads consume attempts and exhausted clients are rejected before parsing', async (t) => {
  const { request, sql } = await setup(t, { UPLOADS_PER_CLIENT_DAY: '1' });
  assert.equal((await request('/shares', 'POST', '{')).status, 400);
  const exhausted = await request('/shares', 'POST', '{');
  assert.equal(exhausted.status, 429);
  assert.equal(
    ((await exhausted.json()) as { error: string }).error,
    'daily_limit',
  );
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    0,
  );
});

test('daily bytes are not refunded when shares are deleted', async (t) => {
  const { request, upload, sql } = await setup(t, {
    UPLOAD_BYTES_GLOBAL_DAY: String(size * 2),
  });
  const share = await upload();
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
  const second = await upload();
  assert.equal(
    (
      await (
        await sql()
      ).exec(`SELECT value FROM metadata WHERE key='stored_bytes'`)
    )[0].value,
    String(size),
  );
  assert.equal(
    (
      await request(`/shares/${second.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${second.deleteToken}`,
      })
    ).status,
    204,
  );
  const response = await request();
  assert.equal(response.status, 429);
  assert.equal(
    ((await response.json()) as { error: string }).error,
    'daily_limit',
  );
  assert.equal(
    (
      await (
        await sql()
      ).exec(`SELECT value FROM metadata WHERE key='stored_bytes'`)
    )[0].value,
    '0',
  );
});

test('read count and bytes are separately limited without affecting removal', async (t) => {
  const { request, upload } = await setup(t, {
    READS_PER_CLIENT_DAY: '2',
    READ_BYTES_GLOBAL_DAY: String(size),
  });
  const share = await upload();
  const path = `/shares/${share.id}`;
  assert.equal((await request(path, 'GET')).status, 200);
  assert.equal(
    (await request(path, 'GET', undefined, { 'CF-Connecting-IP': '192.0.2.4' }))
      .status,
    429,
  );
  assert.equal(
    (
      await request(path, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
});

test('the last allowed R2 write completes, then all sharing routes pause before Turnstile', async (t) => {
  const {
    request,
    upload,
    sql,
    coordinator,
    verificationCalls,
    clientToken,
    mf,
  } = await setup(
    t,
    {
      R2_WRITES_MONTH: '1',
      ENVIRONMENT: 'production',
      TURNSTILE_SECRET: 'production-secret',
    },
    1000,
    { success: true, hostname: '127.0.0.1', action: 'share-upload' },
  );
  const share = await upload({ 'X-Turnstile-Token': 'verified-proof' });
  assert.equal(verificationCalls(), 1);
  assert.equal(
    (await (await mf.getR2Bucket('SHARES')).get(`shares/${share.id}`))?.size,
    size,
  );
  const now = Date.now();
  const resetAt = utcMonthWindow(now).resetAt;
  for (const [path, method] of [
    ['/session', 'POST'],
    ['/shares', 'POST'],
    [`/shares/${share.id}`, 'GET'],
  ]) {
    const response = await request(path, method);
    assert.equal(response.status, 429);
    const error = (await response.json()) as {
      error: string;
      resetAt: number;
      retryAfter: number;
    };
    assert.equal(error.error, 'monthly_limit');
    assert.equal(error.resetAt, resetAt);
    assert.equal(Number(response.headers.get('Retry-After')), error.retryAfter);
    assert.ok(error.retryAfter > 0);
  }
  const direct = await (
    await coordinator()
  ).fetch(
    new Request('https://coordinator/client-check', {
      method: 'POST',
      headers: { 'X-Share-Client': clientToken },
    }),
  );
  assert.equal(direct.status, 429);
  assert.equal(verificationCalls(), 1);
  const [budget] = await (await sql()).exec('SELECT * FROM month_budget');
  assert.equal(budget.writes, 1);
  assert.equal(budget.reads, 0);
  assert.equal(budget.paused, 1);
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
  assert.equal((await request('/session', 'POST')).status, 429);
  assert.equal(
    (
      await (
        await sql()
      ).exec("SELECT value FROM metadata WHERE key='stored_bytes'")
    )[0].value,
    '0',
  );
});

test('concurrent reads cannot overshoot the monthly R2 ceiling and the last reserved read finishes', async (t) => {
  const { request, upload, sql } = await setup(t, { R2_READS_MONTH: '3' });
  const share = await upload();
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => request(`/shares/${share.id}`, 'GET')),
  );
  assert.equal(
    responses.filter((response) => response.status === 200).length,
    3,
  );
  assert.equal(
    responses.filter((response) => response.status === 429).length,
    9,
  );
  for (const response of responses) {
    if (response.status === 200) assert.equal(await response.text(), body);
    else
      assert.equal(
        ((await response.json()) as { error: string }).error,
        'monthly_limit',
      );
  }
  const [budget] = await (await sql()).exec('SELECT * FROM month_budget');
  assert.equal(budget.reads, 3);
  assert.equal(budget.paused, 1);
});

test('failed R2 writes and reads consume monthly attempts without refunds', async (t) => {
  const write = await setup(t, {
    R2_WRITES_MONTH: '1',
    TEST_FAIL_R2_PUT: 'true',
  });
  assert.equal((await write.request()).status, 503);
  const [writeBudget] = await (
    await write.sql()
  ).exec('SELECT * FROM month_budget');
  assert.equal(writeBudget.writes, 1);
  assert.equal(writeBudget.paused, 1);
  assert.equal((await write.request()).status, 429);
  assert.equal(
    (
      await (
        await write.sql()
      ).exec("SELECT value FROM metadata WHERE key='stored_bytes'")
    )[0].value,
    '0',
  );

  const read = await setup(t, {
    R2_READS_MONTH: '1',
    TEST_FAIL_R2_GET: 'true',
  });
  const share = await read.upload();
  assert.equal((await read.request(`/shares/${share.id}`, 'GET')).status, 503);
  const [readBudget] = await (
    await read.sql()
  ).exec('SELECT * FROM month_budget');
  assert.equal(readBudget.reads, 1);
  assert.equal(readBudget.paused, 1);
  assert.equal((await read.request(`/shares/${share.id}`, 'GET')).status, 429);
});

test('a missing R2 object still consumes its attempted monthly read', async (t) => {
  const { request, upload, mf, sql } = await setup(t, { R2_READS_MONTH: '1' });
  const share = await upload();
  await (await mf.getR2Bucket('SHARES')).delete(`shares/${share.id}`);
  assert.equal((await request(`/shares/${share.id}`, 'GET')).status, 404);
  assert.equal(
    (await (await sql()).exec('SELECT reads,paused FROM month_budget'))[0]
      .reads,
    1,
  );
  assert.equal((await request(`/shares/${share.id}`, 'GET')).status, 429);
});

test('storage overflow latches the pause outside rollback and freeing space does not resume the month', async (t) => {
  const { request, upload, sql, coordinator, mf } = await setup(t, {
    STORAGE_BYTES_LIMIT: String(size + 1),
  });
  const share = await upload();
  const rejected = await request();
  assert.equal(rejected.status, 429);
  assert.equal(
    ((await rejected.json()) as { error: string }).error,
    'monthly_limit',
  );
  const [budget] = await (await sql()).exec('SELECT * FROM month_budget');
  assert.equal(budget.paused, 1);
  assert.equal(budget.reason, 'storage');
  assert.equal(budget.writes, 1);
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    1,
  );
  assert.equal(
    (
      await request(`/shares/${share.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${share.deleteToken}`,
      })
    ).status,
    204,
  );
  // Raising a lower configured limit must not clear the sticky monthly latch.
  await (
    await coordinator()
  ).changeLimitsForTest({ STORAGE_BYTES_LIMIT: String(size * 10) });
  assert.equal((await request('/session', 'POST')).status, 429);
  assert.equal(await (await coordinator()).reconstructForTest(), 429);
  assert.equal((await request('/session', 'POST')).status, 429);
  assert.equal(
    (await (await sql()).exec('SELECT paused FROM month_budget'))[0].paused,
    1,
  );
});

test('reaching the storage ceiling pauses following operations but cleanup remains available', async (t) => {
  const { request, upload, sql, coordinator, mf } = await setup(t, {
    STORAGE_BYTES_LIMIT: String(size),
  });
  const share = await upload();
  assert.equal((await request(`/shares/${share.id}`, 'GET')).status, 429);
  await (
    await sql()
  ).exec('UPDATE shares SET expires_at=? WHERE id=?', Date.now() - 1, share.id);
  await (await coordinator()).runCleanupForTest();
  assert.equal(
    await (await mf.getR2Bucket('SHARES')).get(`shares/${share.id}`),
    null,
  );
  assert.equal(
    (
      await (
        await sql()
      ).exec("SELECT value FROM metadata WHERE key='stored_bytes'")
    )[0].value,
    '0',
  );
  assert.equal(
    (await (await sql()).exec('SELECT paused FROM month_budget'))[0].paused,
    1,
  );
  assert.equal((await request('/session', 'POST')).status, 429);
});

test('calendar reset clears only monthly operation counters and preserves live storage', async (t) => {
  const { request, upload, sql } = await setup(t, { R2_WRITES_MONTH: '1' });
  const share = await upload();
  const window = utcMonthWindow(Date.now());
  await (
    await sql()
  ).exec(
    'UPDATE month_budget SET start_at=?,reset_at=? WHERE id=1',
    window.startAt - 31 * 86400000,
    window.startAt,
  );
  assert.equal((await request(`/shares/${share.id}`, 'GET')).status, 200);
  const [budget] = await (await sql()).exec('SELECT * FROM month_budget');
  assert.equal(budget.start_at, window.startAt);
  assert.equal(budget.reset_at, window.resetAt);
  assert.equal(budget.writes, 0);
  assert.equal(budget.reads, 1);
  assert.equal(budget.paused, 0);
  assert.equal(
    (
      await (
        await sql()
      ).exec("SELECT value FROM metadata WHERE key='stored_bytes'")
    )[0].value,
    String(size),
  );
});

test('cleanup cannot release storage reserved by a still-running R2 put', async (t) => {
  const { request, sql, coordinator, mf } = await setup(t, {
    TEST_HOLD_R2_PUT: 'true',
    R2_WRITES_MONTH: '1',
  });
  const uploadResponse = request();
  let pending: Record<string, unknown> | undefined;
  for (let attempt = 0; attempt < 60 && !pending; attempt++) {
    pending = (
      await (await sql()).exec("SELECT * FROM shares WHERE state='pending'")
    )[0];
    if (!pending) await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(pending, 'upload should reserve storage before the delayed R2 put');
  await (
    await sql()
  ).exec(
    'UPDATE shares SET created_at=? WHERE id=?',
    Date.now() - 2 * 60 * 60 * 1000,
    pending.id as string,
  );
  await (await coordinator()).runCleanupForTest();
  assert.equal(
    (await (await sql()).exec('SELECT COUNT(*) AS count FROM shares'))[0].count,
    1,
  );
  assert.equal(
    (
      await (
        await sql()
      ).exec("SELECT value FROM metadata WHERE key='stored_bytes'")
    )[0].value,
    String(size),
  );
  await (await coordinator()).releasePutForTest();
  const response = await uploadResponse;
  assert.equal(response.status, 201);
  const share = (await response.json()) as { id: string };
  assert.equal(
    (await (await mf.getR2Bucket('SHARES')).get(`shares/${share.id}`))?.size,
    size,
  );
  assert.equal(
    (await (await sql()).exec('SELECT state FROM shares'))[0].state,
    'active',
  );
});

test('UTC month boundaries handle year rollover and leap February exactly', () => {
  for (const [input, start, reset] of [
    [
      '2026-12-31T23:59:59.999Z',
      '2026-12-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ],
    [
      '2027-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
      '2027-02-01T00:00:00.000Z',
    ],
    [
      '2024-02-29T23:59:59.999Z',
      '2024-02-01T00:00:00.000Z',
      '2024-03-01T00:00:00.000Z',
    ],
    [
      '2025-02-28T23:59:59.999Z',
      '2025-02-01T00:00:00.000Z',
      '2025-03-01T00:00:00.000Z',
    ],
  ])
    assert.deepEqual(utcMonthWindow(Date.parse(input)), {
      startAt: Date.parse(start),
      resetAt: Date.parse(reset),
    });
});

test('unsafe monthly/storage configuration fails closed instead of raising the free ceiling', async (t) => {
  for (const overrides of [
    { R2_WRITES_MONTH: '10001' },
    { R2_READS_MONTH: '100001' },
    { STORAGE_BYTES_LIMIT: String(4 * 1024 * 1024 * 1024 + 1) },
    { R2_WRITES_MONTH: '0' },
    { R2_READS_MONTH: 'not-a-number' },
  ]) {
    const { request } = await setup(
      t,
      overrides,
      1000,
      { success: false },
      false,
    );
    const response = await request('/session', 'POST');
    assert.equal(response.status, 503);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      'invalid_configuration',
    );
  }
});

test('missing Content-Length and a false small length cannot bypass bounded streaming', async () => {
  const stream = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    const request = new Request('http://localhost/shares', {
      method: 'POST',
      headers,
      body: stream(),
      duplex: 'half',
    } as RequestInit);
    await assert.rejects(
      readBoundedBody(request as never, 15),
      (error: unknown) => (error as { status: number }).status === 413,
    );
  }
  assert.equal(
    (
      await readBoundedBody(
        new Request('http://localhost', {
          method: 'POST',
          body: '12345678',
        }) as never,
        8,
      )
    ).byteLength,
    8,
  );
});

test('a stalled upload times out even when its partial bytes contain complete JSON', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{}'));
    },
  });
  const request = new Request('http://localhost/shares', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(
    readBoundedBody(request as never, 10, 10),
    (error: unknown) => (error as { status: number }).status === 408,
  );
});

test('20 MiB transport limit, JSON complexity and content encoding are enforced', async (t) => {
  const { request } = await setup(t);
  assert.equal(
    (await request('/shares', 'POST', ' '.repeat(MAX_SHARE_BYTES + 1))).status,
    413,
  );
  assert.equal(
    (await request('/shares', 'POST', '['.repeat(17) + ']'.repeat(17))).status,
    400,
  );
  assert.equal(
    (await request('/shares', 'POST', `{"a":[${'0,'.repeat(50001)}0]}`)).status,
    400,
  );
  assert.equal((await request('/shares', 'POST', '{')).status, 400);
  assert.equal(
    (await request('/shares', 'POST', body, { 'Content-Encoding': 'gzip' }))
      .status,
    415,
  );
});
