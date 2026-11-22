import {it,expect} from 'vitest';
import {ProjectResearchIndexQuerySchema,ProjectResearchDetailQuerySchema} from '../src/project-research.contract';
it('bounds research index queries and keeps detail lookup explicit',()=>{
 expect(ProjectResearchIndexQuerySchema.parse({kind:'website'})).toEqual({kind:'website',q:'',limit:10});
 expect(ProjectResearchIndexQuerySchema.safeParse({kind:'intent-fixture',q:'x',limit:'20'}).success).toBe(true);
 expect(ProjectResearchDetailQuerySchema.safeParse({kind:'website'}).success).toBe(true);
});
it('refuses foreign ownership overrides, unbounded input and executable mutation fields',()=>{
 for(const x of [{kind:'unknown'},{kind:'website',limit:0},{kind:'website',limit:21},{kind:'website',q:'x'.repeat(201)},{kind:'website',cursor:'x'.repeat(1001)},{kind:'website',cursor:'invalid cursor'},{kind:'website',projectId:'override'},{kind:'website',send:true}])expect(ProjectResearchIndexQuerySchema.safeParse(x).success).toBe(false);
 expect(ProjectResearchDetailQuerySchema.safeParse({kind:'website',rowId:'override'}).success).toBe(false);
});
