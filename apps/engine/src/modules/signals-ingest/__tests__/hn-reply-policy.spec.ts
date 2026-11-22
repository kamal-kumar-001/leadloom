import {describe,it,expect} from 'vitest';
import {composeReplyBody,ReplyDraftStore,SOURCED_PRODUCT_CLAIMS} from '../reply-drafts';
import {ProjectDiscoveryService} from '../project-discovery.service';
import {PRODUCT_PROFILES} from '../product-profiles.seed';
const profile=PRODUCT_PROFILES.find(p=>p.productId==='feefree')!;
const base={source:'manual' as const,externalId:'policy-one',title:'Need saved reel search',text:'Need saved reel search',url:'https://example.invalid/thread',author:'',postedAt:''};
const hn={...base,source:'hackernews' as const,url:'https://news.ycombinator.com/item?id=123'};
describe('HN generated reply boundary',()=>{
 it('withholds direct composition for HN source even when the story URL is elsewhere',()=>{
  expect(()=>composeReplyBody({...hn,url:'https://example.invalid/story'},SOURCED_PRODUCT_CLAIMS.feefree)).toThrow(/Hacker News/);
 });
 it('withholds composition when a manually selected URL is HN',()=>{
  expect(()=>composeReplyBody({...base,url:'https://NEWS.YCOMBINATOR.COM./item?id=123'},SOURCED_PRODUCT_CLAIMS.feefree)).toThrow(/Hacker News/);
 });
 it('refuses session draft creation before storing anything',()=>{
  const store=new ReplyDraftStore();expect(()=>store.create(hn,profile)).toThrow(/Hacker News/);expect(store.list()).toHaveLength(0);
 });
 it('keeps a research match but returns no generated reply for HN',async()=>{
  const service=new ProjectDiscoveryService({get:async()=>({id:'profile-one',kind:'product_brief',version:1,currentVersion:1,body:JSON.stringify({schema:'leadloom-discovery-profile-v1',displayName:'KeepCue',productUrl:'https://kq.dmpilot.org',problemPhrases:['saved reel'],keywords:['search'],claims:[]})})} as any);
  const result=await service.match('workspace','project',{profileAssetId:'profile-one',profileVersion:1,posts:[hn]});
  expect(result?.matches).toHaveLength(1);expect(result?.matches[0].suggestedReply).toBe('');
  expect((result?.matches[0] as any).replyPolicy).toMatchObject({generation:'withheld',code:'hn_human_only',sourceUrl:'https://news.ycombinator.com/newsguidelines.html'});
 });
 it('refuses approval of a cached legacy HN draft but still permits rejection',()=>{
  const store=new ReplyDraftStore(),draft=store.create(base,profile);
  // Model a draft created before the destination policy existed, with an offsite story URL.
  draft.signalKey='hackernews:legacy-hn:'+profile.productId;
  const reviewed={body:draft.body,destinationUrl:draft.destinationUrl,identity:draft.identity};
  expect(()=>store.decide(draft.id,'approved',reviewed)).toThrow(/Hacker News/);
  expect(store.get(draft.id)?.status).toBe('pending');
  expect(store.decide(draft.id,'rejected',reviewed).status).toBe('rejected');
 });
 it('does not treat an unrelated lookalike host as verified HN',()=>{
  expect(composeReplyBody({...base,url:'https://news.ycombinator.com.example.invalid/item?id=123'},SOURCED_PRODUCT_CLAIMS.feefree).body).toContain('FeeFree');
 });
});
