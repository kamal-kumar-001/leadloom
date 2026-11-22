import {describe,it,expect} from 'vitest';
import {ProjectHnSearchSchema} from '../project-hn-search.contract';
describe('public HN search date/sort input',()=>{
 it('keeps legacy relevance behavior and accepts explicit recent/date input',()=>{expect(ProjectHnSearchSchema.parse({query:'saved reels'})).toEqual({query:'saved reels',sort:'relevance'});expect(ProjectHnSearchSchema.safeParse({query:'saved reels',postedAfter:'2026-11-01T10:00:00+05:30',sort:'recent'}).success).toBe(true);});
 it('rejects naive/invalid dates, invalid sort and private-context/identity overrides',()=>{for(const patch of [{postedAfter:'2026-11-01'},{postedAfter:'2026-11-01T10:00:00'},{postedAfter:'not-a-date'},{sort:'best-leads'},{projectId:'different'},{profileBody:'private content'},{limit:1000}])expect(ProjectHnSearchSchema.safeParse({query:'saved reels',...patch}).success).toBe(false);});
});
