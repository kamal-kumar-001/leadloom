import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RunRegistryStore } from '../run-registry';
import { LandingInput, renderLandingHtml, validateLandingInput } from './render';

export interface LandingRenderResult {
  status: 'SUCCESS';
  htmlPath: string;
  bytes: number;
}

/** Writes a local landing draft HTML file. Local artifact only. */
export class LandingRenderService {
  constructor(
    private readonly outputDir: string,
    private readonly registry?: RunRegistryStore,
  ) {}

  async render(rawInput: unknown): Promise<LandingRenderResult> {
    const startedAt = new Date().toISOString();
    const input: LandingInput = validateLandingInput(rawInput);
    const html = renderLandingHtml(input);
    await mkdir(this.outputDir, { recursive: true });
    const slug = input.productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
    const htmlPath = join(this.outputDir, `landing-${slug}.html`);
    await writeFile(htmlPath, html);
    const bytes = Buffer.byteLength(html, 'utf8');
    await this.registry?.record({ kind: 'landing-render', status: 'SUCCESS', startedAt, finishedAt: new Date().toISOString(), label: input.productName.slice(0, 80), artifacts: [htmlPath] });
    return { status: 'SUCCESS', htmlPath, bytes };
  }
}
