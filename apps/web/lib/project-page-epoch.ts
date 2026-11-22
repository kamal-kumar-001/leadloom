import {AgentTokenListItemSchema,ProjectResponseSchema,type AgentTokenListItem,type AgentTokenResponse} from '@leadloom/contracts';
/** Fences browser reads and one-time reveals only. Never cancels or retries a backend mutation. */
export class ProjectPageEpoch{
 private active=true;private read=0;private selection=0;private revoked=new Set<string>();
 mount(){this.active=true;}
 unmount(){this.active=false;this.read++;this.selection++;}
 beginRead(){return++this.read;}
 acceptsRead(ticket:number){return this.active&&ticket===this.read;}
 mutationCommitted(){if(!this.active)return false;this.read++;return true;}
 changeSelection(){if(!this.active)return false;this.selection++;return true;}
 selectionTicket(){return this.selection;}
 acceptsReveal(ticket:number,id?:string){return this.active&&ticket===this.selection&&(!id||!this.revoked.has(id));}
 noteRevoked(id:string){this.revoked.add(id);}
 isRevoked(id:string){return this.revoked.has(id);}
 isActive(){return this.active;}
}
export function checkedProjectSnapshot(projects:unknown,tokens:unknown){
 const p=ProjectResponseSchema.array().safeParse(projects),t=AgentTokenListItemSchema.array().safeParse(tokens);
 return p.success&&t.success?{projects:p.data,tokens:t.data}:null;
}
/** Allow-list projection: raw token and any unexpected fields never enter a metadata list. */
export function issuedTokenMetadata(token:AgentTokenResponse):AgentTokenListItem{return AgentTokenListItemSchema.parse(token);}
export function mergeTokenMetadata(current:AgentTokenListItem[],item:AgentTokenListItem){const previous=current.find(t=>t.id===item.id);return[{...item,revoked:item.revoked||Boolean(previous?.revoked)},...current.filter(t=>t.id!==item.id)];}
