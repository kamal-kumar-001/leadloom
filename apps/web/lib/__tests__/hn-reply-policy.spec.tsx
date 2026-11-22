import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DraftComposerButton} from '../../components/signals/draft-composer';
const row={source:'manual',externalId:'one',title:'Saved reels',text:'search',url:'https://example.invalid/post',author:'',postedAt:'',match:{productId:'leadloom',score:1,matchedTerms:['search']}} as any;
describe('HN composer presentation',()=>{
 for(const post of [{...row,source:'hackernews'},{...row,url:'https://news.ycombinator.com/item?id=123'}])it('shows research-only rules instead of a generated reply action',()=>{
  const html=renderToStaticMarkup(<DraftComposerButton row={post}/>);expect(html).toContain('Hacker News prohibits');expect(html).toContain('https://news.ycombinator.com/newsguidelines.html');expect(html).not.toContain('Draft a reply');expect(html).not.toContain('<button');
 });
 it('keeps the private draft action on an unreviewed other destination',()=>{expect(renderToStaticMarkup(<DraftComposerButton row={row}/>)).toContain('Draft a reply for review');});
});
