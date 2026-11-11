import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Ports a user-supplied mailbox host may use. Anything else is refused so the engine cannot be used as a port scanner. */
export const SMTP_PORTS = [25, 465, 587, 2525];
export const IMAP_PORTS = [143, 993];

function expandV6(addr: string): number[] | null {
  let h = addr.toLowerCase().split('%')[0];
  const m = h.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (m) { const o = m[2].split('.').map(Number); if (o.some((x) => x > 255)) return null; h = m[1] + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16); }
  const parts = h.split('::'); if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [], tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0; if (fill < 0 || (parts.length === 1 && head.length !== 8)) return null;
  const g = [...head, ...Array(fill).fill('0'), ...tail].map((x) => parseInt(x, 16));
  return g.length === 8 && g.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? g : null;
}

/** True unless the address is a plain public unicast address. IPv6 is an allowlist (global unicast 2000::/3 minus special ranges); mapped IPv4, NAT64, 6to4, ULA, link-local and unparsable forms are all refused. */
export function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) {
    const [a, b, c] = addr.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113) || a >= 224;
  }
  if (isIP(addr) !== 6) return true;
  const g = expandV6(addr); if (!g) return true;
  if (g[0] < 0x2000 || g[0] > 0x3fff) return true;
  if (g[0] === 0x2002) return true;
  if (g[0] === 0x2001 && (g[1] < 0x200 || g[1] === 0xdb8)) return true;
  if (g[0] === 0x3fff && g[1] < 0x1000) return true;
  return false;
}

/** Resolves a mail host once and returns a public address to connect to. Connecting to this address (not the name) closes the DNS-rebinding window between check and use. */
export async function resolvePublic(host: string, resolve: (h: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map((a) => a.address)): Promise<string | null> {
  if (!HOST.test(host) || isIP(host) !== 0) return null;
  let addrs: string[]; try { addrs = await resolve(host); } catch { return null; }
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) return null;
  return addrs.find((a) => isIP(a) === 4) ?? addrs[0];
}

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export type HostCheck = { ok: true } | { ok: false; code: 'invalid_host' | 'private_host' | 'invalid_port' };

/** Hostname must be a public DNS name (no IP literals), and must resolve only to public addresses. */
export async function checkMailHost(host: string, port: number, allowedPorts: number[], allowPrivate = false, resolve: (h: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map((a) => a.address)): Promise<HostCheck> {
  if (allowPrivate) return allowedPorts.includes(port) || (Number.isInteger(port) && port >= 1024 && port <= 65535) ? { ok: true } : { ok: false, code: 'invalid_port' }; // dev/test fixtures only: never reachable in production
  if (!allowedPorts.includes(port)) return { ok: false, code: 'invalid_port' };
  if (!HOST.test(host) || isIP(host) !== 0) return { ok: false, code: 'invalid_host' };
  let addrs: string[];
  try { addrs = await resolve(host); } catch { return { ok: false, code: 'invalid_host' }; }
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) return { ok: false, code: 'private_host' };
  return { ok: true };
}
