import { DurableObject } from 'cloudflare:workers';
import {
  ApiError,
  isShareExpired,
  readBoundedBody,
  utcMonthWindow,
} from './runtime';
import {
  SHARE_TTL_MS,
  MAX_SHARE_BYTES,
  SHARE_ENTRY_LIMITS,
} from '../../shared/share-contract';
const DAY_MS = 24 * 60 * 60 * 1000;
const SHARE_ID = /^[A-Za-z0-9_-]{32}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const CLIENT_TOKEN = /^v1\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/;
const PREFIX = 'shares/';
// These ceilings are intentionally much smaller than the R2 Free allowances.
// Environment overrides may lower them, never raise them.
const SAFE_R2_WRITES_MONTH = 10_000;
const SAFE_R2_READS_MONTH = 100_000;
const SAFE_STORAGE_BYTES = 4 * 1024 * 1024 * 1024;

export interface Env {
  SHARES: R2Bucket;
  SHARE_COORDINATOR: DurableObjectNamespace;
  UPLOAD_RATE_LIMITER: RateLimit;
  READ_RATE_LIMITER: RateLimit;
  DELETE_RATE_LIMITER: RateLimit;
  SESSION_RATE_LIMITER: RateLimit;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  TURNSTILE_HOSTNAMES: string;
  TURNSTILE_SECRET?: string;
  SESSIONS_GLOBAL_DAY?: string;
  UPLOADS_PER_CLIENT_DAY?: string;
  UPLOAD_BYTES_PER_CLIENT_DAY?: string;
  UPLOADS_GLOBAL_DAY?: string;
  UPLOAD_BYTES_GLOBAL_DAY?: string;
  STORAGE_BYTES_LIMIT?: string;
  R2_WRITES_MONTH?: string;
  R2_READS_MONTH?: string;
  READS_PER_CLIENT_DAY?: string;
  READ_BYTES_PER_CLIENT_DAY?: string;
  READS_GLOBAL_DAY?: string;
  READ_BYTES_GLOBAL_DAY?: string;
}

function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json(
      {
        error: error.code,
        message: error.message,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
        ...(error.resetAt !== undefined ? { resetAt: error.resetAt } : {}),
      },
      error.status,
      error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {},
    );
  }
  // Do not log URLs, note contents, tokens, or client IPs.
  console.error(
    'Sharing request failed',
    error instanceof Error ? error.name : 'UnknownError',
  );
  return json(
    {
      error: 'service_unavailable',
      message: 'Sharing is temporarily unavailable. Try again later.',
    },
    503,
    { 'Retry-After': '60' },
  );
}

function csv(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
function loopback(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
function localRequest(request: Request, env: Env) {
  try {
    return (
      env.ENVIRONMENT === 'local' &&
      loopback(new URL(request.url).hostname) &&
      loopback(new URL(request.headers.get('Origin') ?? '').hostname)
    );
  } catch {
    return false;
  }
}

async function verifyTurnstile(request: Request, env: Env, ip: string) {
  const token = request.headers.get('X-Turnstile-Token');
  if (localRequest(request, env) && token === 'local-development') return;
  if (!env.TURNSTILE_SECRET)
    throw new ApiError(503, 'not_configured', 'Sharing is not configured yet.');
  if (!token || token.length > 2048)
    throw new ApiError(
      403,
      'challenge_required',
      'Complete the verification before sharing.',
    );
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new ApiError(
      503,
      'verification_unavailable',
      'Verification is temporarily unavailable.',
    );
  const result = await response.json<{
    success?: boolean;
    hostname?: string;
    action?: string;
  }>();
  if (
    result.success !== true ||
    !result.hostname ||
    !csv(env.TURNSTILE_HOSTNAMES).includes(result.hostname) ||
    result.action !== 'share-upload'
  ) {
    throw new ApiError(
      403,
      'challenge_failed',
      'Verification expired or failed. Please try again.',
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed =
      origin !== null && csv(env.ALLOWED_ORIGINS).includes(origin);
    let response: Response;
    try {
      if (!allowed)
        throw new ApiError(
          403,
          'origin_not_allowed',
          'This origin is not allowed.',
        );
      const url = new URL(request.url);
      const isUpload = url.pathname === '/shares' && request.method === 'POST';
      const isSession =
        url.pathname === '/session' && request.method === 'POST';
      const match = /^\/shares\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      const isItem = match !== null && SHARE_ID.test(match[1]);
      if (
        request.method === 'OPTIONS' &&
        (url.pathname === '/shares' || url.pathname === '/session' || isItem)
      ) {
        response = new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
            'Access-Control-Allow-Headers':
              'Content-Type, Authorization, X-Turnstile-Token, X-Share-Client',
            'Access-Control-Max-Age': '600',
          },
        });
      } else {
        if (
          !isUpload &&
          !isSession &&
          !(isItem && ['GET', 'DELETE'].includes(request.method))
        )
          throw new ApiError(404, 'not_found', 'Share not found.');
        const ip =
          request.headers.get('CF-Connecting-IP') ??
          (localRequest(request, env) ? '127.0.0.1' : '');
        if (!ip)
          throw new ApiError(
            403,
            'client_unknown',
            'The client could not be verified.',
          );
        const limiter = isSession
          ? env.SESSION_RATE_LIMITER
          : isUpload
            ? env.UPLOAD_RATE_LIMITER
            : request.method === 'DELETE'
              ? env.DELETE_RATE_LIMITER
              : env.READ_RATE_LIMITER;
        if (!(await limiter.limit({ key: ip })).success)
          throw new ApiError(
            429,
            'rate_limited',
            'Too many requests. Please wait a minute.',
            60,
          );
        const headers = new Headers();
        if (request.headers.has('X-Share-Client'))
          headers.set('X-Share-Client', request.headers.get('X-Share-Client')!);
        if (request.headers.has('Authorization'))
          headers.set('Authorization', request.headers.get('Authorization')!);
        const stub = env.SHARE_COORDINATOR.get(
          env.SHARE_COORDINATOR.idFromName('admission-v1'),
        );
        // workerd can expose an empty stream for POST with Content-Length: 0.
        // Do not read/buffer user data for anonymous identity issuance.
        if (
          isSession &&
          request.body &&
          request.headers.get('Content-Length') !== '0'
        )
          throw new ApiError(
            400,
            'invalid_request',
            'Session creation does not accept a body.',
          );
        if (isUpload) {
          if (
            request.headers.get('Content-Encoding') &&
            request.headers.get('Content-Encoding') !== 'identity'
          )
            throw new ApiError(
              415,
              'encoding_not_supported',
              'Send an uncompressed JSON bundle.',
            );
          if (
            request.headers
              .get('Content-Type')
              ?.split(';')[0]
              .trim()
              .toLowerCase() !== 'application/json'
          )
            throw new ApiError(
              415,
              'invalid_content_type',
              'Send a JSON sharing bundle.',
            );
          const length = request.headers.get('Content-Length');
          if (
            length &&
            (!/^\d+$/.test(length) || Number(length) > MAX_SHARE_BYTES)
          )
            throw new ApiError(
              413,
              'too_large',
              'A share can be at most 20 MiB.',
            );
          // Validate before spending the one-use Turnstile proof. The client can
          // replace a missing/invalid identity and retry with the same proof.
          const identity = await stub.fetch(
            new Request('https://coordinator/client-check', {
              method: 'POST',
              headers,
            }),
          );
          if (identity.status !== 204) {
            response = identity;
          } else {
            await verifyTurnstile(request, env, ip);
            response = await stub.fetch(
              new Request(`https://coordinator${url.pathname}`, {
                method: 'POST',
                headers,
                body: request.body,
              }),
            );
          }
        } else {
          response = await stub.fetch(
            new Request(`https://coordinator${url.pathname}`, {
              method: request.method,
              headers,
            }),
          );
        }
      }
    } catch (error) {
      response = errorResponse(error);
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Vary', 'Origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', origin!);
      headers.set(
        'Access-Control-Expose-Headers',
        'X-Share-Expires-At, X-Share-Created-At, Retry-After',
      );
    }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;

function randomToken(bytes: number) {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i++)
    difference |= left.charCodeAt(i) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}
function positiveLimit(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new ApiError(
      503,
      'invalid_configuration',
      'Sharing limits are not configured correctly.',
    );
  return parsed;
}
function safeLimit(value: string | undefined, maximum: number) {
  const limit = positiveLimit(value, maximum);
  if (limit > maximum)
    throw new ApiError(
      503,
      'invalid_configuration',
      'Sharing limits exceed the safe free budget.',
    );
  return limit;
}

// Validate only the transport envelope here. The client performs the full graph,
// Markdown and image validation before preview/import. Never render this JSON as HTML.
function validateEnvelope(bytes: Uint8Array) {
  // Bound structural complexity before JSON.parse allocates an object graph.
  // A 20 MiB array of tiny objects can otherwise exhaust the isolate's memory.
  let depth = 0;
  let tokens = 0;
  let quoted = false;
  let escaped = false;
  for (const byte of bytes) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (byte === 92) escaped = true;
      else if (byte === 34) quoted = false;
    } else if (byte === 34) quoted = true;
    else if (byte === 123 || byte === 91) {
      depth++;
      tokens++;
      if (depth > 16)
        throw new ApiError(
          400,
          'invalid_bundle',
          'The sharing bundle is too deeply nested.',
        );
    } else if (byte === 125 || byte === 93) depth--;
    else if (byte === 44 || byte === 58) tokens++;
    if (tokens > 50_000)
      throw new ApiError(
        400,
        'invalid_bundle',
        'The sharing bundle is too complex.',
      );
  }
  let value: unknown;
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    );
  } catch {
    throw new ApiError(
      400,
      'invalid_bundle',
      'The sharing bundle is not valid JSON.',
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'invalid_bundle', 'The sharing bundle is invalid.');
  const bundle = value as Record<string, unknown>;
  if (
    bundle.format !== 'learnmd-share' ||
    bundle.version !== 1 ||
    !['note', 'folder'].includes(String(bundle.kind)) ||
    typeof bundle.title !== 'string' ||
    bundle.title.length > 500 ||
    !bundle.title.trim() ||
    !Array.isArray(bundle.notes) ||
    bundle.notes.length > SHARE_ENTRY_LIMITS.notes ||
    !Array.isArray(bundle.folders) ||
    bundle.folders.length > SHARE_ENTRY_LIMITS.folders ||
    !Array.isArray(bundle.assets) ||
    bundle.assets.length > SHARE_ENTRY_LIMITS.assets
  ) {
    throw new ApiError(
      400,
      'invalid_bundle',
      'The sharing bundle has an unsupported format.',
    );
  }
}

type ShareRow = {
  id: string;
  bytes: number;
  created_at: number;
  expires_at: number;
  delete_hash: string;
  state: string;
  [column: string]: string | number;
};
type Counter = { count: number; bytes: number; [column: string]: number };
type MonthBudget = {
  id: number;
  start_at: number;
  reset_at: number;
  reads: number;
  writes: number;
  paused: number;
  reason: string;
  [column: string]: number | string;
};
type BudgetLimits = { reads: number; writes: number; storage: number };

export class ShareCoordinator extends DurableObject<Env> {
  private uploadInFlight = false;
  private uploadInFlightId: string | null = null;
  private salt: string;
  private signingKey?: Promise<CryptoKey>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, delete_hash TEXT NOT NULL, state TEXT NOT NULL)`,
    );
    ctx.storage.sql.exec(
      `CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires_at)`,
    );
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, bytes INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
    );
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS month_budget (id INTEGER PRIMARY KEY CHECK(id=1), start_at INTEGER NOT NULL, reset_at INTEGER NOT NULL, reads INTEGER NOT NULL, writes INTEGER NOT NULL, paused INTEGER NOT NULL, reason TEXT NOT NULL)`,
    );
    ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO metadata(key,value) VALUES ('salt',?), ('stored_bytes','0')`,
      randomToken(32),
    );
    this.salt = ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM metadata WHERE key='salt'`)
      .one().value;
  }

  async fetch(request: Request) {
    try {
      const path = new URL(request.url).pathname;
      // Revocation/cleanup remain usable while R2 reads and writes are paused.
      // Check before client verification, Turnstile (edge client-check), or body reads.
      if (request.method !== 'DELETE') this.requireMonthlyBudget(Date.now());
      if (request.method === 'POST' && path === '/session')
        return await this.createSession();
      if (request.method === 'POST' && path === '/client-check') {
        await this.verifyClient(request);
        return new Response(null, { status: 204 });
      }
      if (request.method === 'POST' && path === '/shares')
        return await this.upload(request, await this.verifyClient(request));
      const id = path.slice('/shares/'.length);
      if (!SHARE_ID.test(id))
        throw new ApiError(404, 'not_found', 'Share not found.');
      if (request.method === 'GET')
        return await this.download(id, await this.verifyClient(request));
      if (request.method === 'DELETE') return await this.revoke(id, request);
      throw new ApiError(404, 'not_found', 'Share not found.');
    } catch (error) {
      return errorResponse(error);
    }
  }

  private budgetLimits(): BudgetLimits {
    return {
      writes: safeLimit(this.env.R2_WRITES_MONTH, SAFE_R2_WRITES_MONTH),
      reads: safeLimit(this.env.R2_READS_MONTH, SAFE_R2_READS_MONTH),
      storage: safeLimit(this.env.STORAGE_BYTES_LIMIT, SAFE_STORAGE_BYTES),
    };
  }

  private monthBudget(now: number): MonthBudget {
    const window = utcMonthWindow(now);
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO month_budget VALUES (1,?,?,0,0,0,'')`,
      window.startAt,
      window.resetAt,
    );
    let row = this.ctx.storage.sql
      .exec<MonthBudget>('SELECT * FROM month_budget WHERE id=1')
      .one();
    if (now >= row.reset_at) {
      // Only operation counters and the monthly latch reset. Object reservations
      // and stored_bytes still describe the R2 objects remaining on disk.
      this.ctx.storage.sql.exec(
        `UPDATE month_budget SET start_at=?,reset_at=?,reads=0,writes=0,paused=0,reason='' WHERE id=1`,
        window.startAt,
        window.resetAt,
      );
      row = {
        id: 1,
        start_at: window.startAt,
        reset_at: window.resetAt,
        reads: 0,
        writes: 0,
        paused: 0,
        reason: '',
      };
    }
    return row;
  }

  private pauseMonth(row: MonthBudget, reason: string) {
    this.ctx.storage.sql.exec(
      'UPDATE month_budget SET paused=1,reason=? WHERE id=1',
      reason,
    );
    return { ...row, paused: 1, reason };
  }

  private checkMonthlyBudget(now: number, limits: BudgetLimits) {
    const row = this.monthBudget(now);
    if (row.paused) return row;
    if (row.writes >= limits.writes) return this.pauseMonth(row, 'writes');
    if (row.reads >= limits.reads) return this.pauseMonth(row, 'reads');
    if (this.storedBytes() >= limits.storage)
      return this.pauseMonth(row, 'storage');
    return null;
  }

  private monthlyError(row: MonthBudget, now: number) {
    return new ApiError(
      429,
      'monthly_limit',
      'Sharing is paused until the free monthly budget resets.',
      Math.max(1, Math.ceil((row.reset_at - now) / 1000)),
      row.reset_at,
    );
  }

  private requireMonthlyBudget(now: number) {
    const limits = this.budgetLimits();
    const blocked = this.ctx.storage.transactionSync(() =>
      this.checkMonthlyBudget(now, limits),
    );
    // Throw outside the transaction: throwing inside would roll back the pause.
    if (blocked) throw this.monthlyError(blocked, now);
  }

  private reserveR2Read(now: number) {
    const limits = this.budgetLimits();
    const blocked = this.ctx.storage.transactionSync(() => {
      const paused = this.checkMonthlyBudget(now, limits);
      if (paused) return paused;
      const row = this.monthBudget(now);
      this.ctx.storage.sql.exec(
        'UPDATE month_budget SET reads=reads+1 WHERE id=1',
      );
      // The last reserved read is allowed to finish. Its successors see the latch.
      if (row.reads + 1 >= limits.reads) this.pauseMonth(row, 'reads');
      return null;
    });
    if (blocked) throw this.monthlyError(blocked, now);
  }

  private async signClient(id: string) {
    this.signingKey ??= crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.salt),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      await this.signingKey,
      new TextEncoder().encode(`learnmd:anonymous-share-client:v1:${id}`),
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  private async createSession() {
    this.ctx.storage.transactionSync(() =>
      this.consume(
        'session:global',
        1,
        0,
        positiveLimit(this.env.SESSIONS_GLOBAL_DAY, 10000),
        Number.MAX_SAFE_INTEGER,
        Date.now(),
      ),
    );
    await this.ensureAlarm();
    const id = randomToken(24);
    return json({ token: `v1.${id}.${await this.signClient(id)}` }, 201);
  }

  private async verifyClient(request: Request) {
    const match = CLIENT_TOKEN.exec(
      request.headers.get('X-Share-Client') ?? '',
    );
    if (!match || !constantTimeEqual(await this.signClient(match[1]), match[2]))
      throw new ApiError(
        401,
        'invalid_client',
        'The anonymous browser identity is missing or invalid.',
      );
    return match[1];
  }

  private counter(key: string): Counter {
    return (
      this.ctx.storage.sql
        .exec<Counter>('SELECT count,bytes FROM counters WHERE key=?', key)
        .toArray()[0] ?? { count: 0, bytes: 0 }
    );
  }
  private consume(
    key: string,
    count: number,
    bytes: number,
    countLimit: number,
    byteLimit: number,
    now: number,
    commit = true,
  ) {
    const day = Math.floor(now / DAY_MS);
    const counterKey = `${key}:${day}`;
    const current = this.counter(counterKey);
    if (current.count + count > countLimit || current.bytes + bytes > byteLimit)
      throw new ApiError(
        429,
        'daily_limit',
        'The daily sharing limit was reached. Please try again tomorrow.',
        Math.max(1, Math.ceil(((day + 1) * DAY_MS - now) / 1000)),
      );
    if (!commit) return;
    this.ctx.storage.sql.exec(
      'INSERT INTO counters(key,count,bytes,expires_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+excluded.count, bytes=bytes+excluded.bytes',
      counterKey,
      count,
      bytes,
      (day + 2) * DAY_MS,
    );
  }
  private uploadQuota(
    client: string,
    count: number,
    size: number,
    now: number,
    commit = true,
  ) {
    this.consume(
      `upload:client:${client}`,
      count,
      size,
      positiveLimit(this.env.UPLOADS_PER_CLIENT_DAY, 20),
      positiveLimit(this.env.UPLOAD_BYTES_PER_CLIENT_DAY, 100 * 1024 * 1024),
      now,
      commit,
    );
    this.consume(
      'upload:global',
      count,
      size,
      positiveLimit(this.env.UPLOADS_GLOBAL_DAY, 500),
      positiveLimit(this.env.UPLOAD_BYTES_GLOBAL_DAY, 500 * 1024 * 1024),
      now,
      commit,
    );
  }
  private precheckUpload(client: string) {
    const now = Date.now();
    this.requireMonthlyBudget(now);
    this.ctx.storage.transactionSync(() => {
      this.uploadQuota(client, 1, 1, now, false);
      // Failed/malformed/timed-out uploads consume attempts too: otherwise a
      // single client could monopolize the bounded upload slot indefinitely.
      this.uploadQuota(client, 1, 0, now);
    });
  }
  private readQuota(client: string, count: number, size: number, now: number) {
    this.consume(
      `read:client:${client}`,
      count,
      size,
      positiveLimit(this.env.READS_PER_CLIENT_DAY, 500),
      positiveLimit(this.env.READ_BYTES_PER_CLIENT_DAY, 1024 * 1024 * 1024),
      now,
    );
    this.consume(
      'read:global',
      count,
      size,
      positiveLimit(this.env.READS_GLOBAL_DAY, 10000),
      positiveLimit(this.env.READ_BYTES_GLOBAL_DAY, 10 * 1024 * 1024 * 1024),
      now,
    );
  }
  private storedBytes() {
    return Number(
      this.ctx.storage.sql
        .exec<{ value: string }>(
          `SELECT value FROM metadata WHERE key='stored_bytes'`,
        )
        .one().value,
    );
  }
  private row(id: string) {
    return this.ctx.storage.sql
      .exec<ShareRow>('SELECT * FROM shares WHERE id=?', id)
      .toArray()[0];
  }
  private active(id: string, now: number) {
    const row = this.row(id);
    if (!row || row.state !== 'active')
      throw new ApiError(
        404,
        'not_found',
        'This link is unavailable or was disabled.',
      );
    if (isShareExpired(now, row.expires_at))
      throw new ApiError(410, 'expired', 'This link expired after 7 days.');
    return row;
  }

  private async upload(request: Request, client: string) {
    // One buffered upload globally bounds peak memory for 20 MiB JSON parsing.
    if (this.uploadInFlight)
      throw new ApiError(
        429,
        'upload_busy',
        'Another upload is finishing. Try again in a few seconds.',
        5,
      );
    this.uploadInFlight = true;
    try {
      this.precheckUpload(client);
      await this.ensureAlarm();
      const bytes = await readBoundedBody(request);
      validateEnvelope(bytes);
      const id = randomToken(24);
      const deleteToken = randomToken(32);
      const deleteHash = await sha256(deleteToken);
      const createdAt = Date.now();
      const expiresAt = createdAt + SHARE_TTL_MS;
      const limits = this.budgetLimits();
      const blocked = this.ctx.storage.transactionSync(() => {
        const paused = this.checkMonthlyBudget(createdAt, limits);
        if (paused) return paused;
        const month = this.monthBudget(createdAt);
        const stored = this.storedBytes();
        if (stored + bytes.byteLength > limits.storage)
          return this.pauseMonth(month, 'storage');
        this.uploadQuota(client, 0, bytes.byteLength, createdAt);
        this.ctx.storage.sql.exec(
          `UPDATE metadata SET value=? WHERE key='stored_bytes'`,
          String(stored + bytes.byteLength),
        );
        this.ctx.storage.sql.exec(
          'INSERT INTO shares VALUES (?,?,?,?,?,?)',
          id,
          bytes.byteLength,
          createdAt,
          expiresAt,
          deleteHash,
          'pending',
        );
        this.ctx.storage.sql.exec(
          'UPDATE month_budget SET writes=writes+1 WHERE id=1',
        );
        if (month.writes + 1 >= limits.writes) this.pauseMonth(month, 'writes');
        else if (stored + bytes.byteLength >= limits.storage)
          this.pauseMonth(month, 'storage');
        return null;
      });
      if (blocked) throw this.monthlyError(blocked, createdAt);
      // No await between admission and the R2 attempt. The alarm was scheduled
      // before buffering. Count failures/aborts as attempts; never refund them.
      this.uploadInFlightId = id;
      try {
        await this.env.SHARES.put(PREFIX + id, bytes, {
          storageClass: 'Standard',
          httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'no-store',
          },
        });
        this.ctx.storage.sql.exec(
          `UPDATE shares SET state='active' WHERE id=?`,
          id,
        );
      } catch (error) {
        this.ctx.storage.sql.exec(
          `UPDATE shares SET state='revoked' WHERE id=?`,
          id,
        );
        try {
          await this.deleteObject(id);
        } catch {
          /* alarm retries; reservation remains */
        }
        throw error;
      }
      return json({ id, createdAt, expiresAt, deleteToken }, 201);
    } finally {
      this.uploadInFlightId = null;
      this.uploadInFlight = false;
    }
  }

  private async download(id: string, client: string) {
    this.ctx.storage.transactionSync(() =>
      this.readQuota(client, 1, 0, Date.now()),
    );
    await this.ensureAlarm();
    const row = this.active(id, Date.now());
    this.ctx.storage.transactionSync(() =>
      this.readQuota(client, 0, row.bytes, Date.now()),
    );
    this.reserveR2Read(Date.now());
    const object = await this.env.SHARES.get(PREFIX + id);
    if (!object)
      throw new ApiError(
        404,
        'not_found',
        'This link is unavailable or was disabled.',
      );
    // Recheck after async I/O: expiry/revocation can happen during the R2 read.
    this.active(id, Date.now());
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(row.bytes),
        'Cache-Control': 'no-store',
        'X-Share-Created-At': String(row.created_at),
        'X-Share-Expires-At': String(row.expires_at),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  private async revoke(id: string, request: Request) {
    const token = request.headers
      .get('Authorization')
      ?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    if (!token || !TOKEN.test(token))
      throw new ApiError(
        401,
        'unauthorized',
        'The link removal token is required.',
      );
    const hash = await sha256(token);
    const row = this.row(id);
    if (!row)
      throw new ApiError(
        404,
        'not_found',
        'This link is unavailable or was disabled.',
      );
    if (!constantTimeEqual(hash, row.delete_hash))
      throw new ApiError(
        403,
        'forbidden',
        'This link removal token is invalid.',
      );
    this.ctx.storage.sql.exec(
      `UPDATE shares SET state='revoked' WHERE id=?`,
      id,
    );
    await this.ensureAlarm();
    await this.deleteObject(id);
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  private async deleteObject(id: string) {
    await this.env.SHARES.delete(PREFIX + id);
    // R2 delete is idempotent. Only the first confirmed deletion releases bytes.
    this.ctx.storage.transactionSync(() => {
      const row = this.row(id);
      if (!row) return;
      this.ctx.storage.sql.exec(
        `UPDATE metadata SET value=? WHERE key='stored_bytes'`,
        String(Math.max(0, this.storedBytes() - row.bytes)),
      );
      this.ctx.storage.sql.exec('DELETE FROM shares WHERE id=?', id);
    });
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }

  async alarm() {
    try {
      const now = Date.now();
      const rows = this.ctx.storage.sql
        .exec<ShareRow>(
          `SELECT * FROM shares WHERE (? IS NULL OR id<>?) AND (expires_at<=? OR state='revoked' OR (state='pending' AND created_at<=?)) LIMIT 20`,
          this.uploadInFlightId,
          this.uploadInFlightId,
          now,
          now - 60 * 60 * 1000,
        )
        .toArray();
      for (const row of rows) await this.deleteObject(row.id);
      this.ctx.storage.sql.exec(
        'DELETE FROM counters WHERE expires_at<=?',
        now,
      );
      const remaining = this.ctx.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM shares')
        .one().count;
      const counters = this.ctx.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM counters')
        .one().count;
      if (remaining > 0 || counters > 0)
        await this.ctx.storage.setAlarm(
          now + (rows.length === 20 ? 60_000 : 60 * 60 * 1000),
        );
    } catch {
      // Keep retrying after a downstream outage, beyond the platform's finite
      // automatic alarm retries. Do not release accounting before R2 confirms.
      await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
    }
  }
}
