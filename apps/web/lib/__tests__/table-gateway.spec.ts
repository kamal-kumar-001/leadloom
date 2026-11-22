import {it,expect} from 'vitest';
import {resolveEnginePath} from '../agent-gateway';
const id='11111111-2222-4333-8444-555555555555';
it('opens only saved table list/import/rows/text-edit method paths, never arbitrary table mutation',()=>{
 for(const [method,tail]of [['GET',''],['POST','/import'],['GET','/'+id+'/rows'],['PATCH','/'+id+'/cells']]){const path='workspace/tables'+tail;expect(resolveEnginePath(method,path.split('/'))).toBe('/'+path);}
 for(const [method,tail]of [['DELETE','/'+id],['POST','/'+id+'/rows'],['GET','/'+id+'/export'],['PUT','/'+id+'/cells'],['GET','/not-a-uuid/rows'],['POST','/import/extra']])expect(resolveEnginePath(method,('workspace/tables'+tail).split('/'))).toBeNull();
});

it('campaign draft ingress opens create only, never draft lifecycle or recipient operations',()=>{expect(resolveEnginePath('POST',['project','campaign-drafts'])).toBe('/agent/project/campaign-drafts');for(const m of ['GET','PUT','PATCH','DELETE'])expect(resolveEnginePath(m,['project','campaign-drafts'])).toBeNull();for(const s of ['recipients','approve','release','send','status'])expect(resolveEnginePath('POST',['project','campaign-drafts',id,s])).toBeNull();});

it('project table ingress grants only list/import/rows/text-edit, never export or lifecycle',()=>{for(const [m,t]of [['GET',''],['POST','/import'],['GET','/'+id+'/rows'],['PATCH','/'+id+'/cells']])expect(resolveEnginePath(m,('project/tables'+t).split('/'))).toBe('/agent/project/tables'+t);for(const [m,t]of [['DELETE','/'+id],['GET','/'+id+'/export'],['POST','/'+id+'/rows'],['PUT','/'+id+'/cells']])expect(resolveEnginePath(m,('project/tables'+t).split('/'))).toBeNull();});
