import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
it('standalone web image includes public hero assets as well as Next static output', () => {
  const root=path.resolve(import.meta.dirname,'../../../..');
  const docker=readFileSync(path.join(root,'docker/web.Dockerfile'),'utf8');
  expect(docker).toContain('COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public');
  expect(docker).toContain('COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static');
  for(const name of ['approval-scene-v5.mp4','approval-scene-v5-poster.png','approval-scene-light-v1.mp4','approval-scene-light-v1-poster.png'])expect(existsSync(path.join(root,'apps/web/public/hero',name))).toBe(true);
});
