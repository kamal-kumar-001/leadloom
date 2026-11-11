import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Ports a user-supplied mailbox host may use. Anything else is refused so the engine cannot be used as a port scanner. */
export const SMTP_PORTS = [25, 465, 587, 2525];
export const IMAP_PORTS = [143, 993];

export function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = addr.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v.startsWith('fc') || v.startsWith('fd') || /^fe[89ab]/.test(v);
}

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export type HostCheck = { ok: true } | { ok: false; code: 'invalid_host' | 'private_host' | 'invalid_port' };

/** Hostname must be a public DNS name (no IP literals), and must resolve only to public addresses. */
export async function checkMailHost(host: string, port: number, allowedPorts: number[], allowPrivate = false, resolve: (h: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map((a) => a.address)): Promise<HostCheck> {
  if (!allowedPorts.includes(port)) return { ok: false, code: 'invalid_port' };
  if (allowPrivate) return { ok: true };
  if (!HOST.test(host) || isIP(host) !== 0) return { ok: false, code: 'invalid_host' };
  let addrs: string[];
  try { addrs = await resolve(host); } catch { return { ok: false, code: 'invalid_host' }; }
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) return { ok: false, code: 'private_host' };
  return { ok: true };
}
