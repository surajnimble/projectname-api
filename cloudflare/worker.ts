/**
 * Cloudflare Worker front door for the Express API.
 *
 * The application is one long-running process: Socket.IO keeps room state in
 * memory and BullMQ workers plus the in-process cron run inside the same
 * process. A single named container instance preserves those semantics; the
 * Worker only forwards requests and keeps the instance awake.
 */
import { Container } from '@cloudflare/containers';

const INSTANCE_NAME = 'api';
const CONTAINER_PORT = 5000;

/**
 * First boot runs migrations and the seed before Express starts listening, so
 * the normal 20 second port wait is too short. Later boots reuse the same
 * timeout but return as soon as the port is healthy.
 */
const FIRST_BOOT_TIMEOUT_MS = 180_000;

type ContainerContext = ConstructorParameters<typeof Container>[0];

export interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  [key: string]: unknown;
}

/**
 * Worker vars and secrets are the only source of container configuration.
 * Non-string bindings, such as the container namespace itself, are skipped.
 */
const containerEnv = (env: Env): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (key !== 'API_CONTAINER' && typeof value === 'string') {
      values[key] = value;
    }
  }

  return values;
};

export class ApiContainer extends Container<Env> {
  defaultPort = CONTAINER_PORT;
  sleepAfter = '30m';
  pingEndpoint = 'localhost/api/v1/health';
  enableInternet = true;
  envVars: Record<string, string>;

  constructor(ctx: ContainerContext, env: Env) {
    super(ctx, env);
    this.envVars = containerEnv(env);
  }

  override async fetch(request: Request): Promise<Response> {
    await this.startAndWaitForPorts({
      ports: CONTAINER_PORT,
      cancellationOptions: { portReadyTimeoutMS: FIRST_BOOT_TIMEOUT_MS },
    });

    return super.fetch(request);
  }
}

const apiContainer = (env: Env) => env.API_CONTAINER.getByName(INSTANCE_NAME);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return apiContainer(env).fetch(request);
  },

  /**
   * The app's own cron and BullMQ repeatable jobs only run while the container
   * is awake. A health request every ten minutes keeps the thirty minute idle
   * timer from ever expiring.
   */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await apiContainer(env).fetch(new Request('http://localhost/api/v1/health'));
  },
};
