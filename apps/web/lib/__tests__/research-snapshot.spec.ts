import {it,expect} from 'vitest';
import {canSaveResearchSnapshot} from '../research-snapshot';
it('allows a nonempty pasted snapshot and refuses empty snapshots',()=>{
 expect(canSaveResearchSnapshot('pasted_text','Exact analyzed text')).toBe(true);
 expect(canSaveResearchSnapshot('pasted_text','  ')).toBe(false);
});
it('never saves fetched output using a stale earlier pasted snapshot',()=>{
 expect(canSaveResearchSnapshot('fetched_url','Old pasted Kubernetes text')).toBe(false);
 expect(canSaveResearchSnapshot('fetched_url','')).toBe(false);
});
