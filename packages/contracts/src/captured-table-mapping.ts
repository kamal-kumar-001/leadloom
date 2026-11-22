/** Deliberately conservative. Never infer a field from a substring in a caller header. */
export type CapturedTableField='email'|'name'|'company';
export function capturedTableField(header:string):CapturedTableField|null{
 const h=header.trim().toLowerCase().replace(/[ _-]+/g,' ');
 if(['email','email address','work email'].includes(h))return 'email';
 if(['name','full name','contact name'].includes(h))return 'name';
 if(['company','company name','organization','organisation'].includes(h))return 'company';
 return null;
}
export interface SavedTableSchema{revision:string;table:{id:string;name:string};columns:{id:string;name:string;type:string}[]}
