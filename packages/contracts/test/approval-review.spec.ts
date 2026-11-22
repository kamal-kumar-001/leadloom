import {it,expect} from 'vitest';
import {ApproveOutboundJobRequestSchema} from '../src/outbound.contract';
const id='0e1f7801-577f-4aee-b479-670faef7f138',other='d2f9270c-75d7-4a2a-b879-1cf89cd492d3',hash='a'.repeat(64);
it('accepts exact bounded reviewed jobs and an explicit null refresh-only revision',()=>{for(const revision of [hash,null])expect(ApproveOutboundJobRequestSchema.safeParse({jobIds:[id],expectedRevisions:{[id]:revision}}).success).toBe(true);});
it('refuses legacy approve-all/id-only and incomplete or extra review bindings',()=>{for(const input of [{all:true},{jobIds:[id]},{jobIds:[id],expectedRevisions:{}},{jobIds:[id],expectedRevisions:{[id]:hash,[other]:hash}},{jobIds:[id,id],expectedRevisions:{[id]:hash}},{jobIds:[id],expectedRevisions:{[id]:'not-a-hash'}},{jobIds:[],expectedRevisions:{}}])expect(ApproveOutboundJobRequestSchema.safeParse(input).success).toBe(false);});
