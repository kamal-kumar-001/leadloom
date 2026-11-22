import {describe,it,expect} from 'vitest';
import {generatedReplyPolicy} from '../channel-reply-policy';
describe('generated-reply destination policy',()=>{
 for(const url of ['https://news.ycombinator.com/item?id=1','https://NEWS.YCOMBINATOR.COM./item?id=2','https://news.ycombinator.com:443/item?id=3','https://www.news.ycombinator.com/item?id=4'])it('withholds manual HN destination '+url,()=>{expect(generatedReplyPolicy({source:'manual',url})).toMatchObject({generation:'withheld',code:'hn_human_only',checkedAt:'2026-11-22'});});
 it('withholds the HN source even when its story points offsite',()=>{expect(generatedReplyPolicy({source:'hackernews',url:'https://example.invalid/story'}).generation).toBe('withheld');});
 it('does not certify unknown channels, invalid URLs or lookalike hosts',()=>{
  for(const url of ['https://news.ycombinator.com.example.invalid/','https://example.invalid/','not a URL'])expect(generatedReplyPolicy({source:'manual',url})).toMatchObject({generation:'unreviewed',code:'channel_review_required',sourceUrl:null});
 });
});
