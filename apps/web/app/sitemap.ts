import type { MetadataRoute } from 'next';

/**
 * Returns the canonical base URL.
 * Uses process.env.NEXT_PUBLIC_APP_URL or process.env.NEXTAUTH_URL if configured,
 * falling back to the verified live production origin: https://leadloom.dmpilot.org.
 */
export function getProductionBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://leadloom.dmpilot.org';
  return url.replace(/\/+$/, '');
}

/**
 * Public Sitemap generator.
 * Statically enumerates only public product and marketing pages.
 * NEVER exposes private app workspaces, API routes, or customer project context.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getProductionBaseUrl();
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/forgot-password`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
