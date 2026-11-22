/** Fetched results do not carry a reproducible raw-text save snapshot. */
export function canSaveResearchSnapshot(input:'pasted_text'|'fetched_url',text:string):boolean{
 return input==='pasted_text'&&text.trim().length>0;
}
