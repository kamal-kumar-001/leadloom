/** Destination rules are checked facts, not authorization to post on any channel. */
export interface GeneratedReplyPolicy {
  generation:'withheld'|'unreviewed';
  code:'hn_human_only'|'channel_review_required';
  reason:string;
  sourceUrl:string|null;
  checkedAt:string|null;
}
export function generatedReplyPolicy(post:{source:string;url:string}):GeneratedReplyPolicy {
  let host='';try{host=new URL(post.url).hostname.toLowerCase().replace(/\.+$/,'');}catch{}
  if(post.source==='hackernews'||host==='news.ycombinator.com'||host.endsWith('.news.ycombinator.com'))return{
    generation:'withheld',code:'hn_human_only',
    reason:'Hacker News prohibits generated or AI-edited posts/comments and automated posting. Keep this result for research; write any HN text yourself without AI generation or editing.',
    sourceUrl:'https://news.ycombinator.com/newsguidelines.html',checkedAt:'2026-11-22',
  };
  return{generation:'unreviewed',code:'channel_review_required',reason:'Channel rules have not been checked. Suggested words are private, unreviewed text, not permission or readiness to post.',sourceUrl:null,checkedAt:null};
}
export function assertGeneratedReplyAvailable(post:{source:string;url:string}):void {
 const policy=generatedReplyPolicy(post);if(policy.generation==='withheld')throw new Error(policy.reason+' Rules: '+policy.sourceUrl);
}
