// RFC-style quoted CSV/TSV parser for a bounded import, not line splitting.
export function parseTableCsv(source:string):{columns:string[];rows:string[][]}{
 if(new TextEncoder().encode(source).length>524288)throw new Error('CSV must be 512 KB or smaller.');
 const text=source.replace(/^\uFEFF/,'');let quoted=false,first='';
 for(let i=0;i<text.length;i++){if(text[i]==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}if(!quoted&&(text[i]==='\r'||text[i]==='\n'))break;if(!quoted)first+=text[i];}
 const delimiter=first.includes('\t')?'\t':',';const parsed:string[][]=[];let row:string[]=[],field='',inQuotes=false,closed=false,atStart=true;
 const pushField=()=>{row.push(field);field='';atStart=true;closed=false;};
 const pushRow=()=>{pushField();if(!(row.length===1&&row[0]===''))parsed.push(row);row=[];if(parsed.length>501)throw new Error('Import supports at most 500 data rows.');};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(inQuotes){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{inQuotes=false;closed=true;}}else field+=ch;continue;}
  if(ch===delimiter){pushField();continue;}
  if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
  if(closed){if(ch===' '||ch==='\t')continue;throw new Error('Unexpected characters after a quoted field.');}
  if(ch==='"'){if(!atStart)throw new Error('Quotes inside unquoted fields must be escaped.');inQuotes=true;atStart=false;continue;}
  field+=ch;atStart=false;
 }
 if(inQuotes)throw new Error('CSV ends inside an unclosed quoted field.');if(field!==''||row.length||closed)pushRow();
 if(parsed.length<2)throw new Error('CSV needs a header and at least one data row.');
 const columns=parsed[0].map(h=>h.trim()),rows=parsed.slice(1);
 if(columns.length>30||columns.some(h=>!h||h.length>100))throw new Error('Use 1 to 30 non-empty column names, each at most 100 characters.');
 if(new Set(columns.map(h=>h.toLowerCase())).size!==columns.length)throw new Error('Column names must be unique.');
 if(rows.some(r=>r.length!==columns.length))throw new Error('Every row must have the same number of fields as the header.');
 if(rows.some(r=>r.some(v=>v.length>1000)))throw new Error('Each cell must be at most 1000 characters.');
 return{columns,rows};
}
