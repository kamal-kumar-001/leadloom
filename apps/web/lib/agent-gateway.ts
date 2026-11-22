// Strict allowlist mapping for public customer coding agent gateway.
// Only allows specific method + path combinations for context, validator, and research.
// Never accept arbitrary paths, never trust incoming host headers, never mint session or bridge tokens.

export const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
export const MAX_BODY_BYTES = 262_144; // 256KB hard limit

export function resolveEnginePath(method: string, segments: string[]): string | null {
  const m = method.toUpperCase();
  if(segments[0]==='project'&&segments[1]==='stress'&&['plans','reports'].includes(segments[2])){
    const prefix='/agent/project/stress/'+segments[2];if(segments.length===3)return m==='POST'?prefix:null;
    if(segments.length===4&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[3]))return m==='GET'?prefix+'/'+segments[3]:null;return null;
  }
  if(segments[0]==='project'&&segments[1]==='reviews'){
    if(segments.length===3&&segments[2]==='intake')return m==='POST'?'/agent/project/reviews/intake':null;
    if(segments.length===3&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[2]))return m==='GET'?'/agent/project/reviews/'+segments[2]:null;return null;
  }
  if(segments[0]==='project'&&segments[1]==='founder'){
    if(segments.length===2)return m==='POST'?'/agent/project/founder':null;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[2]??''))return null;
    const prefix='/agent/project/founder/'+segments[2];if(segments.length===3)return m==='GET'?prefix:null;
    if(segments.length===4&&['tasks','reports','implementation'].includes(segments[3]))return m==='POST'?prefix+'/'+segments[3]:null;
    if(segments.length===4&&segments[3]==='export')return m==='GET'?prefix+'/export':null;return null;
  }
  if(segments.length===3&&segments[0]==='project'&&segments[1]==='posts'&&['prepare','record-preview'].includes(segments[2]))return m==='POST'?'/agent/project/posts/'+segments[2]:null;
  if(segments.join('/')==='project/discovery/match')return m==='POST'?'/agent/project/discovery/match':null;
  if(segments.join('/')==='project/inventory')return m==='GET'?'/agent/project/inventory':null;
  if(segments.join('/')==='project/research/hn-search')return m==='POST'?'/agent/project/research/hn-search':null;
  if(segments.join('/')==='project/research/index')return m==='GET'?'/agent/project/research/index':null;
  if(segments.length===4&&segments[0]==='project'&&segments[1]==='research'&&segments[2]==='records'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[3]))return m==='GET'?'/agent/project/research/records/'+segments[3]:null;
  if(segments.join('/')==='project/research')return m==='GET'?'/agent/project/research':null;

  if(segments[0]==='project'&&segments[1]==='tables'){
    if(segments.length===2&&m==='GET')return '/agent/project/tables';
    if(segments.length===3&&segments[2]==='import'&&m==='POST')return '/agent/project/tables/import';
    if(segments.length===4&&/^[a-f0-9-]{36}$/i.test(segments[2])){
      if(segments[3]==='rows'&&m==='GET')return '/agent/project/tables/'+segments[2]+'/rows';
      if(segments[3]==='cells'&&m==='PATCH')return '/agent/project/tables/'+segments[2]+'/cells';
    }return null;
  }
  // Workspace saved text tables. Engine enforces explicit read/write scope and denies bound project tokens.
  if(segments[0]==='workspace'&&segments[1]==='tables'){
    if(segments.length===2&&m==='GET')return '/workspace/tables';
    if(segments.length===3&&segments[2]==='import'&&m==='POST')return '/workspace/tables/import';
    if(segments.length===4&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[2])){
      if(segments[3]==='rows'&&m==='GET')return '/workspace/tables/'+segments[2]+'/rows';
      if(segments[3]==='cells'&&m==='PATCH')return '/workspace/tables/'+segments[2]+'/cells';
    }
    return null;
  }

  if(segments.length===3&&segments[0]==='project'&&segments[1]==='campaign-drafts'&&/^[a-f0-9-]{36}$/i.test(segments[2])&&(m==='GET'||m==='PUT'))return '/agent/project/campaign-drafts/'+segments[2];
  if(segments.join('/')==='project/experiment-drafts')return m==='POST'?'/agent/project/experiment-drafts':null;
  if(segments.join('/')==='project/campaign-drafts')return m==='POST'?'/agent/project/campaign-drafts':null;
  // 1. Context operations
  // /api/agent/context or /api/agent/agent/context -> /agent/context
  if (
    (segments.length === 1 && segments[0] === 'context') ||
    (segments.length === 2 && segments[0] === 'agent' && segments[1] === 'context')
  ) {
    if (m === 'GET' || m === 'POST' || m === 'PUT') {
      return '/agent/context';
    }
    return null;
  }

  // Bounded project work record. Project identity comes only from the bearer token.
  const contextSegments=segments[0]==='agent'?segments.slice(1):segments;
  if(contextSegments[0]==='context'&&contextSegments[1]==='entries'){
    if(contextSegments.length===2&&(m==='GET'||m==='POST'))return '/agent/context/entries';
    if(contextSegments.length===3&&contextSegments[2]==='brief'&&m==='GET')return '/agent/context/entries/brief';
    if(contextSegments.length===3&&m==='GET'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(contextSegments[2]))return '/agent/context/entries/'+contextSegments[2];
    return null;
  }

  if(segments[0]==='project'&&segments[1]==='assets'){
    if(segments.length===2&&(m==='GET'||m==='POST'))return '/agent/project/assets';
    if(segments.length===3&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segments[2])&&(m==='GET'||m==='PUT'))return '/agent/project/assets/'+segments[2];
    return null;
  }
  if(m==='GET'&&segments.length===2&&segments[0]==='project'&&segments[1]==='experiments')return '/agent/project/experiments';
  if(m==='GET'&&segments.length===4&&segments[0]==='project'&&segments[1]==='experiments'&&ID_RE.test(segments[2])&&segments[3]==='results')return '/agent/project/experiments/'+encodeURIComponent(segments[2])+'/results';
  if(m==='GET'&&segments.length===4&&segments[0]==='project'&&segments[1]==='experiments'&&ID_RE.test(segments[2])&&segments[3]==='page')return '/agent/project/experiments/'+encodeURIComponent(segments[2])+'/page';

  if(m==='GET'&&segments.length===2&&segments[0]==='project'&&segments[1]==='campaigns')return '/agent/project/campaigns';
  if(m==='GET'&&segments.length===4&&segments[0]==='project'&&segments[1]==='campaigns'&&ID_RE.test(segments[2])&&segments[3]==='jobs')return '/agent/project/campaigns/'+encodeURIComponent(segments[2])+'/jobs';
  // 2. Validator operations
  // GET|POST /api/agent/validator/experiments -> /validator/experiments
  if (segments.length === 2 && segments[0] === 'validator' && segments[1] === 'experiments') {
    if (m === 'POST' || m === 'GET') return '/validator/experiments';
    return null;
  }

  // GET /api/agent/workspace/experiments -> /workspace/experiments
  if (segments.length === 2 && segments[0] === 'workspace' && segments[1] === 'experiments') {
    if (m === 'GET') return '/workspace/experiments';
    return null;
  }

  // /api/agent/validator/experiments/:id/(publish|unpublish|outreach|scorecard|page|leads)
  if (
    segments.length === 4 &&
    segments[0] === 'validator' &&
    segments[1] === 'experiments' &&
    ID_RE.test(segments[2])
  ) {
    const id = encodeURIComponent(segments[2]);
    const action = segments[3];

    if (action === 'page' && m === 'PUT') return `/validator/experiments/${id}/page`;
    if (action === 'publish' && m === 'POST') return `/validator/experiments/${id}/publish`;
    if (action === 'unpublish' && m === 'POST') return `/validator/experiments/${id}/unpublish`;
    if (action === 'outreach' && m === 'POST') return `/validator/experiments/${id}/outreach`;
    if (action === 'scorecard' && m === 'GET') return `/validator/experiments/${id}/scorecard`;
    if (action === 'page' && m === 'GET') return `/validator/experiments/${id}/page`;
    if (action === 'leads' && m === 'GET') return `/validator/experiments/${id}/leads`;
    return null;
  }

  // GET /api/agent/validator/experiments/:id/leads/export -> /validator/experiments/:id/leads/export
  if (
    segments.length === 5 &&
    segments[0] === 'validator' &&
    segments[1] === 'experiments' &&
    ID_RE.test(segments[2]) &&
    segments[3] === 'leads' &&
    segments[4] === 'export'
  ) {
    const id = encodeURIComponent(segments[2]);
    if (m === 'GET') return `/validator/experiments/${id}/leads/export`;
    return null;
  }

  // Read-only campaign observation, with explicit engine-enforced workspace scope.
  // No campaign mutations, recipients, approval, release or sending routes.
  if(m==='GET'&&segments.length===2&&segments[0]==='workspace'&&segments[1]==='campaigns')return '/workspace/campaigns';
  if(m==='GET'&&segments.length===3&&segments[0]==='campaigns'&&ID_RE.test(segments[1])&&segments[2]==='jobs')return '/campaigns/'+encodeURIComponent(segments[1])+'/jobs';

  // 3. Research operations
  // POST /api/agent/research/website-signals -> /research/website-signals
  if (segments.length === 2 && segments[0] === 'research' && segments[1] === 'website-signals') {
    if (m === 'POST') return '/research/website-signals';
    return null;
  }

  // POST /api/agent/research/website-signals/save -> /research/website-signals/save
  if (
    segments.length === 3 &&
    segments[0] === 'research' &&
    segments[1] === 'website-signals' &&
    segments[2] === 'save'
  ) {
    if (m === 'POST') return '/research/website-signals/save';
    return null;
  }

  // GET /api/agent/research/leads -> /research/leads
  if (segments.length === 2 && segments[0] === 'research' && segments[1] === 'leads') {
    if (m === 'GET') return '/research/leads';
    return null;
  }

  // POST /api/agent/research/intent-fixture -> /research/intent-fixture
  if (segments.length === 2 && segments[0] === 'research' && segments[1] === 'intent-fixture') {
    if (m === 'POST') return '/research/intent-fixture';
    return null;
  }

  // POST /api/agent/research/intent-fixture/save -> /research/intent-fixture/save
  if (
    segments.length === 3 &&
    segments[0] === 'research' &&
    segments[1] === 'intent-fixture' &&
    segments[2] === 'save'
  ) {
    if (m === 'POST') return '/research/intent-fixture/save';
    return null;
  }

  // GET /api/agent/research/intent-signals -> /research/intent-signals
  if (segments.length === 2 && segments[0] === 'research' && segments[1] === 'intent-signals') {
    if (m === 'GET') return '/research/intent-signals';
    return null;
  }

  return null;
}
