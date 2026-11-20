import { createHash } from 'node:crypto';
import { IncomingPost } from '../types';

interface ManualJsonItem {
  title?: string;
  text?: string;
  url?: string;
  author?: string;
  postedAt?: string;
}

/**
 * Manual import: content the USER personally selected and is permitted to use
 * (they opened a thread and chose to bring it in). This is not a scraping or
 * bulk-export workaround for sources whose APIs we have not cleared.
 *
 * Accepted input, as one string:
 * - a JSON array of { title?, text, url?, author?, postedAt? }, or
 * - one item per line as: url | title | text
 */
export class ManualImportAdapter {
  parse(input: string): IncomingPost[] {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Manual import: input is empty.');
    if (trimmed.startsWith('[')) return this.parseJson(trimmed);
    return this.parseLines(trimmed);
  }

  private parseJson(input: string): IncomingPost[] {
    let items: ManualJsonItem[];
    try {
      items = JSON.parse(input) as ManualJsonItem[];
    } catch {
      throw new Error('Manual import: invalid JSON array.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Manual import: JSON must be a non-empty array.');
    }
    return items.map((item, i) => this.toPost(item.title ?? '', item.text ?? '', item.url ?? '', item.author ?? '', item.postedAt ?? '', i));
  }

  private parseLines(input: string): IncomingPost[] {
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((line, i) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 3 || !parts[2]) {
        throw new Error(`Manual import: line ${i + 1} must be "url | title | text".`);
      }
      return this.toPost(parts[1], parts.slice(2).join(' | '), parts[0], '', '', i);
    });
  }

  private toPost(title: string, text: string, url: string, author: string, postedAt: string, index: number): IncomingPost {
    if (!text) throw new Error(`Manual import: item ${index + 1} has no text.`);
    const externalId = createHash('sha256').update(`${url}\n${text}`).digest('hex').slice(0, 16);
    return { source: 'manual', externalId, title, text, url, author, postedAt };
  }
}
