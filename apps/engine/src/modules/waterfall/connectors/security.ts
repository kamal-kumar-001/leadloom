import { ConnectorContext, ConnectorError } from './connector.interface';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Redacts secret tokens and URL credential query parameters from strings.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  if (!text) return '';
  let cleaned = String(text);

  // Redact explicit secret strings (if non-empty and non-trivial)
  for (const s of secrets) {
    if (s && s.length >= 3) {
      cleaned = cleaned.split(s).join('[REDACTED]');
    }
  }

  // Redact common URL parameter credential leaks: ?key=..., &api_key=..., etc.
  cleaned = cleaned.replace(/([?&](?:api_?key|key|token|access_token|secret)=)[^&#\s]+/gi, '$1[REDACTED]');

  return cleaned;
}

/**
 * Sanitizes URLs for logging or storage in results.
 */
export function sanitizeUrl(rawUrl: string, secrets: Array<string | undefined> = []): string {
  return redactSecrets(rawUrl, secrets);
}

/**
 * Validates and resolves ctx.baseUrl against the vendor's default URL.
 * - Vendors: protocol MUST be https: and hostname MUST match the default host.
 * - Ollama (allowLocalHttp: true): protocol can be http/https, but hostname MUST be loopback
 *   (127.0.0.1, localhost, ::1). Rejects cloud metadata (169.254.169.254, metadata.google.internal)
 *   and link-local / external networks.
 */
export function validateAndResolveBaseUrl(
  defaultBaseUrl: string,
  ctxBaseUrl?: string,
  options?: { allowLocalHttp?: boolean }
): { url: string; error?: ConnectorError } {
  if (!ctxBaseUrl || ctxBaseUrl.trim() === '') {
    return { url: defaultBaseUrl.replace(/\/+$/, '') };
  }

  const cleanCtx = ctxBaseUrl.trim();
  let parsedCtx: URL;
  let parsedDefault: URL;

  try {
    parsedCtx = new URL(cleanCtx);
  } catch {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: 'Invalid baseUrl format: must be a valid absolute URL',
        retryable: false,
      },
    };
  }

  try {
    parsedDefault = new URL(defaultBaseUrl);
  } catch {
    parsedDefault = new URL('https://api.leadloom.invalid');
  }

  if(parsedCtx.username||parsedCtx.password||parsedCtx.search||parsedCtx.hash||(!options?.allowLocalHttp&&parsedCtx.port!==parsedDefault.port))return{url:defaultBaseUrl,error:{code:'INVALID_BASE_URL',message:'Base URL must not contain credentials, query, fragment or an alternate vendor port',retryable:false}};

  if (options?.allowLocalHttp) {
    // Ollama: allow http or https only for localhost / 127.0.0.1 / ::1
    if (parsedCtx.protocol !== 'http:' && parsedCtx.protocol !== 'https:') {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: `Local baseUrl protocol must be http: or https:, got "${parsedCtx.protocol}"`,
          retryable: false,
        },
      };
    }

    const hostWithoutPort = parsedCtx.hostname.toLowerCase();

    // Explicitly reject cloud metadata addresses & link-local
    if (
      hostWithoutPort === '169.254.169.254' ||
      hostWithoutPort.startsWith('169.254.') ||
      hostWithoutPort === 'metadata.google.internal' ||
      hostWithoutPort === 'instance-data'
    ) {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: 'Cloud metadata and link-local addresses are strictly prohibited',
          retryable: false,
        },
      };
    }

    if (!LOOPBACK_HOSTNAMES.has(hostWithoutPort)) {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: `Local daemon baseUrl host must be loopback (127.0.0.1, localhost, ::1); got "${hostWithoutPort}"`,
          retryable: false,
        },
      };
    }

    return { url: cleanCtx.replace(/\/+$/, '') };
  }

  // Remote vendors: protocol MUST be https:
  if (parsedCtx.protocol !== 'https:') {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: `Vendor baseUrl must use HTTPS; rejected insecure protocol "${parsedCtx.protocol}"`,
        retryable: false,
      },
    };
  }

  // Hostname must strictly equal default hostname
  if (parsedCtx.hostname.toLowerCase() !== parsedDefault.hostname.toLowerCase()) {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: `Base URL redirect rejected: hostname "${parsedCtx.hostname}" must match default vendor host "${parsedDefault.hostname}"`,
        retryable: false,
      },
    };
  }

  return { url: cleanCtx.replace(/\/+$/, '') };
}

/**
 * Resolves the fetch function for a connector call.
 * Uses ctx.fetch if provided.
 * If not provided, only falls back to global fetch when LEADLOOM_CONNECTORS_LIVE_ENABLED === 'true'.
 * Otherwise returns a NETWORK_DISABLED error (default posture).
 */
export function resolveFetch(ctx: ConnectorContext): { fetchFn?: typeof fetch; error?: ConnectorError } {
  if (ctx.fetch) {
    return { fetchFn: ctx.fetch };
  }

  if (process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED === 'true') {
    return { fetchFn: globalThis.fetch };
  }

  return {
    error: {
      code: 'NETWORK_DISABLED',
      message:
        'Live connector calls are disabled by default (LEADLOOM_CONNECTORS_LIVE_ENABLED != true) and no test fixture fetch was provided in context',
      retryable: false,
    },
  };
}

/**
 * Safely executes a fetch request with redirect: 'manual' to prevent credentials
 * from following HTTP redirects to foreign hosts.
 */
export async function safeFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<Response> {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Invalid connector timeout');
  const controller=new AbortController(),timeout=Math.min(30000,timeoutMs),maxBytes=1048576;
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,response:Response|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)controller.abort();
  const cancel=()=>{if(reader)void reader.cancel().catch(()=>{});else if(response?.body)void response.body.cancel().catch(()=>{});};
  try{
    return await Promise.race([
      (async()=>{
        response=await fetchImpl(url,{...init,redirect:'manual',signal:controller.signal});
        if(controller.signal.aborted){cancel();throw new Error('Connector request aborted; outcome unconfirmed');}
        if(!response.ok||response.type==='opaqueredirect'||response.status>=300&&response.status<400){cancel();return response;}
        if(Number(response.headers?.get('content-length'))>maxBytes){cancel();throw new Error('Connector response too large; outcome unconfirmed');}
        if(response.body?.getReader){
          reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
          for(;;){const part=await reader.read();if(controller.signal.aborted)throw new Error('Connector request aborted; outcome unconfirmed');if(part.done)break;size+=part.value.length;if(size>maxBytes){cancel();throw new Error('Connector response too large; outcome unconfirmed');}chunks.push(part.value);}
          return new Response([204,205].includes(response.status)?null:Buffer.concat(chunks),{status:response.status,statusText:response.statusText,headers:response.headers});
        }
        // Older injected fixture transports expose only json(). Global fetch must supply a real body.
        if(fetchImpl===globalThis.fetch)return new Response(null,{status:response.status,headers:response.headers});
        const data=await response.json(),encoded=JSON.stringify(data);if(typeof encoded!=='string'||Buffer.byteLength(encoded)>maxBytes)throw new Error('Connector response too large; outcome unconfirmed');
        return Object.assign({},response,{json:async()=>data}) as Response;
      })(),
      new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();cancel();reject(new Error('Connector request timed out; outcome unconfirmed. Do not retry blindly.'));},timeout);}),
    ]);
  }catch(error){cancel();throw error;}finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);try{reader?.releaseLock();}catch{/* A pending reader is already being canceled. */}}
}

/**
 * Checks if a fetch response is a 3xx redirect or opaqueredirect.
 * All redirects are treated as provider errors so secrets are never leaked.
 */
export function checkRedirectResponse(response: { status: number; type?: string }): ConnectorError | null {
  if ((response.status >= 300 && response.status < 400) || response.type === 'opaqueredirect') {
    return {
      code: 'PROVIDER_ERROR',
      status: response.status || 302,
      message: `HTTP redirect (${response.status || 302}) blocked: redirects are disabled for credential security`,
      retryable: false,
    };
  }
  return null;
}
