import {z} from 'zod';
import {ProjectResponseSchema} from '@leadloom/contracts';
import type {WorkspaceSummary} from './engine-client';
export type RecordStatus='loading'|'unavailable'|'present'|'absent';
const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Summary=z.object({tables:count,mailboxes:count,campaigns:count,suppressions:count,experiments:count,providerKeys:count}).strict();
export function checkedWorkspaceSummary(value:unknown):WorkspaceSummary|null{const parsed=Summary.safeParse(value);return parsed.success?parsed.data:null;}
export function summaryRecordStatus(state:{data:WorkspaceSummary|null;isLoading:boolean;error:string|null},field:keyof WorkspaceSummary):RecordStatus{
 if(state.isLoading)return'loading';if(state.error||!state.data)return'unavailable';return state.data[field]>0?'present':'absent';
}
export function projectRecordStatus(result:{projects:unknown;error?:string}):RecordStatus{
 if(result.error)return'unavailable';const parsed=ProjectResponseSchema.array().safeParse(result.projects);return parsed.success?(parsed.data.length?'present':'absent'):'unavailable';
}
export function setupRecordProgress(statuses:RecordStatus[]){const present=statuses.filter(s=>s==='present').length,unknown=statuses.filter(s=>s==='loading'||s==='unavailable').length;return{present,unknown,total:statuses.length,percent:unknown||statuses.length===0?null:Math.round(present/statuses.length*100)};}
