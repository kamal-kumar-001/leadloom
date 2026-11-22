import {it,expect} from 'vitest';import {parseTableCsv} from '../table-csv';
it('preserves quoted commas, escaped quotes, multiline fields, BOM and leading zeros',()=>{expect(parseTableCsv('\uFEFFCompany,Code,Notes\r\n"Example, Inc.",00012,"Quoted ""yes""\nline two"\r\n')).toEqual({columns:['Company','Code','Notes'],rows:[['Example, Inc.','00012','Quoted "yes"\nline two']]});});
it('parses tab separated text and keeps empty fields',()=>{expect(parseTableCsv('Company\tEmail\nName\t\n')).toEqual({columns:['Company','Email'],rows:[['Name','']]});});
it('does not use a quoted tab to select the delimiter',()=>{expect(parseTableCsv('"Company\tname",Email\na,b')).toEqual({columns:['Company\tname','Email'],rows:[['a','b']]});});
it('rejects invalid quotes, width, duplicate or empty headers and oversized fields',()=>{for(const text of ['a,b\n"unclosed,b','a,b\nx','a,A\nx,y',',b\nx,y','a,b\nx"y,z','a\n'+('x'.repeat(1001))])expect(()=>parseTableCsv(text)).toThrow();});
it('never silently truncates excess rows or bytes',()=>{expect(()=>parseTableCsv('a\n'+Array.from({length:501},()=> 'x').join('\n'))).toThrow(/500/);expect(()=>parseTableCsv('a\n'+('x'.repeat(524288)))).toThrow(/512 KB/);});
