import {describe,it,expect} from 'vitest';
import {currentProviderKeyRecords} from '../provider-key-records';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const newest={id:a,provider:'openai',label:'Newer saved row',maskedKey:'maskedNEW2',isValid:false,quotaRemaining:null,lastVerifiedAt:null,createdAt:'2026-11-22T01:02:03.000Z'};
const older={...newest,id:b,label:'Older saved row',maskedKey:'maskedOLD1',isValid:true,lastVerifiedAt:'2026-11-22T02:00:00.000Z',createdAt:'2026-11-21T01:02:03.000Z'};
describe('provider key records',()=>{
 it('keeps the server-selected newest row and never borrows an older verification',()=>{expect(currentProviderKeyRecords([newest,older])?.openai).toEqual(newest);});
 it('preserves native order when serialized timestamps tie, without a client-side id re-sort',()=>{expect(currentProviderKeyRecords([newest,{...older,createdAt:newest.createdAt}])?.openai.id).toBe(a);});
 it('selects each provider independently',()=>{expect(Object.keys(currentProviderKeyRecords([newest,{...older,provider:'apollo'}])!)).toEqual(['openai','apollo']);});
 it('distinguishes a confirmed empty vault from unavailable or malformed metadata',()=>{expect(currentProviderKeyRecords([])).toEqual({});for(const bad of [null,undefined,{},[{}],[{...newest,isValid:'true'}],[{...newest,createdAt:'wrong'}],[{...newest,provider:'unknown-provider'}]])expect(currentProviderKeyRecords(bad)).toBeNull();});
 it('refuses duplicate credential identities',()=>{expect(currentProviderKeyRecords([newest,newest])).toBeNull();});
 it('does not retain unexpected fields or accept a plaintext-key response',()=>{expect(currentProviderKeyRecords([{...newest,apiKey:'must-never-be-retained'}])).toBeNull();});
});
