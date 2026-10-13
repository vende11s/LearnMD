// Test-only entrypoint. Production Wrangler points at src/worker.ts.
import handler, {
  ShareCoordinator as ProductionCoordinator,
  type Env,
} from '../src/index';
export default handler;

export class ShareCoordinator extends ProductionCoordinator {
  private releasePut?: () => void;
  constructor(
    ctx: DurableObjectState,
    env: Env & {
      TEST_FAIL_R2_PUT?: string;
      TEST_FAIL_R2_GET?: string;
      TEST_HOLD_R2_PUT?: string;
    },
  ) {
    let releasePut: (() => void) | undefined;
    const putGate =
      env.TEST_HOLD_R2_PUT === 'true'
        ? new Promise<void>((resolve) => {
            releasePut = resolve;
          })
        : undefined;
    const bucket = new Proxy(env.SHARES, {
      get(target, property) {
        if (
          (property === 'put' && env.TEST_FAIL_R2_PUT === 'true') ||
          (property === 'get' && env.TEST_FAIL_R2_GET === 'true')
        )
          return async () => {
            throw new Error('Injected R2 failure');
          };
        if (property === 'put')
          return async (
            key: string,
            value:
              | ReadableStream
              | ArrayBuffer
              | ArrayBufferView
              | string
              | null
              | Blob,
            options?: R2PutOptions,
          ) => {
            if (options?.storageClass !== 'Standard')
              throw new Error('R2 writes must explicitly use Standard storage');
            if (putGate) await putGate;
            return target.put(key, value, options);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    super(ctx, { ...env, SHARES: bucket });
    this.releasePut = releasePut;
  }

  async runCleanupForTest() {
    await this.alarm();
  }
  changeLimitsForTest(overrides: Record<string, string>) {
    Object.assign(this.env, overrides);
  }
  releasePutForTest() {
    this.releasePut?.();
  }
  async reconstructForTest() {
    const fresh = new ProductionCoordinator(this.ctx, this.env);
    return (
      await fresh.fetch(
        new Request('https://coordinator/session', { method: 'POST' }),
      )
    ).status;
  }
}
