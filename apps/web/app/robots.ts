import type { MetadataRoute } from 'next';
import { getProductionBaseUrl } from './sitemap';

/**
 * Robots.txt crawl policy.
 * Strictly fences public search engine crawlers to public product marketing pages.
 * Explicitly forbids indexing or crawling private authenticated application routes (/app/*),
 * backend API endpoints (/api/*), admin portals (/admin/*), or sensitive token query strings.
 * Uses configured URL override or falls back to verified live origin https://leadloom.dmpilot.org.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getProductionBaseUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/$',
          '/login',
          '/signup',
          '/forgot-password',
        ],
        disallow: [
          '/app/',
          '/app/*',
          '/api/',
          '/api/*',
          '/admin/',
          '/admin/*',
          '/verify-email',
          '/signals-preview',
          '/*?*token=*',
          '/*?*key=*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
