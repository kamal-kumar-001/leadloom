/**
 * FinOps Resource Interceptor for Playwright / Headless Scrapers.
 * Strictly blocks images, media, fonts, and stylesheets to prevent memory bloat on 4GB VPS.
 */
export const BLOCKED_RESOURCE_TYPES = new Set([
  'image',
  'media',
  'font',
  'stylesheet',
  'other',
]);

export function shouldBlockRequest(resourceType: string, url: string): boolean {
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
    return true;
  }

  const lower = url.toLowerCase();
  const blockedExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.ogg', '.mp3', '.wav',
    '.css',
  ];

  return blockedExtensions.some(ext => lower.includes(ext));
}
