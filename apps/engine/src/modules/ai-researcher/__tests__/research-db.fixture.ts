import {randomUUID} from 'node:crypto';
/** Unit fixture only. Native tests own actual locks, transactions and constraints. */
export function fakeResearchDb(){
 const tables:any[]=[],columns:any[]=[],rows:any[]=[],cells:any[]=[];
 const state=[tables,columns,rows,cells];
 const db:any={
  $transaction:async(fn:any)=>{const snapshot=structuredClone(state);try{return await fn(db);}catch(e){for(let i=0;i<state.length;i++)state[i].splice(0,state[i].length,...snapshot[i]);throw e;}},
  $queryRawUnsafe:async(sql:string,id:string)=>sql.includes('MAX(order_index)')?[{last:Math.max(-1,...rows.filter(r=>r.tableId===id).map(r=>r.orderIndex))}]:[{id}],
  table:{findFirst:async({where}:any)=>tables.find(t=>t.workspaceId===where.workspaceId&&t.name===where.name)??null,findMany:async({where,take}:any)=>tables.filter(t=>t.workspaceId===where.workspaceId&&t.name===where.name).slice(0,take??100),create:async({data}:any)=>{const t={id:randomUUID(),rowCount:0,...data};tables.push(t);return t;},update:async({where,data}:any)=>{const t=tables.find(t=>t.id===where.id);if(typeof data.rowCount==='number')t.rowCount=data.rowCount;else if(data.rowCount?.increment)t.rowCount+=data.rowCount.increment;return t;}},
  column:{create:async({data}:any)=>{const c={id:randomUUID(),...data};columns.push(c);return c;},findMany:async({where}:any)=>columns.filter(c=>c.tableId===where.tableId)},
  row:{count:async({where}:any)=>rows.filter(r=>r.tableId===where.tableId).length,create:async({data}:any)=>{const r={id:randomUUID(),...data};rows.push(r);return r;},findMany:async({where,take}:any)=>rows.filter(r=>r.tableId===where.tableId).sort((a,b)=>b.orderIndex-a.orderIndex).slice(0,take??50)},
  cell:{create:async({data}:any)=>{const c={id:randomUUID(),...data};cells.push(c);return c;},findMany:async({where}:any)=>cells.filter(c=>c.tableId===where.tableId&&where.rowId.in.includes(c.rowId))},
 };return db;
}
