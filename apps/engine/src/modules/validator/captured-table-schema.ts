import {createHash} from 'node:crypto';
export const capturedTableSchemaRevision=(columns:{id:string;name:string;type:string}[])=>createHash('sha256').update(JSON.stringify(columns.map(c=>({id:c.id,name:c.name,type:c.type})))).digest('hex');
