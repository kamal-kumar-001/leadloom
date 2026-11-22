'use client';
import {ProjectGrowthReview} from '../../../components/projects/project-growth-review';
import React,{useState,useEffect,useCallback,useRef} from 'react';
import {Button} from '@leadloom/ui';
import {RefreshCw,AlertCircle,FolderGit2} from 'lucide-react';
import {ProjectSelectorCard,AgentTokensCard,TokenRevealCard,AgentSetupInstructions,SetupHealthCard} from '../../../components/projects';
import {fetchWorkspaceProjects,fetchWorkspaceAgentTokens} from '../../../lib/engine-client';
import type {ProjectResponse,AgentTokenListItem,AgentTokenResponse} from '@leadloom/contracts';
import {notify} from '../../../lib/notify';
import {ProjectPageEpoch,checkedProjectSnapshot,issuedTokenMetadata,mergeTokenMetadata} from '../../../lib/project-page-epoch';
import {ProjectSnapshot} from '../../../components/projects/project-snapshot';
import {ProjectInventoryCard} from '../../../components/projects/project-inventory';
import {ProjectAssets} from '../../../components/projects/project-assets';
import {ProjectWorkRecord} from '../../../components/projects/project-work-record';
export default function ProjectsPage({apiUrl}:{apiUrl:string|null}){
 const [projects,setProjects]=useState<ProjectResponse[]>([]),[tokens,setTokens]=useState<AgentTokenListItem[]>([]),[selectedProject,setSelectedProject]=useState<ProjectResponse|null>(null);
 // Raw credential exists only in this one-time reveal, never in token metadata or browser storage.
 const [revealedToken,setRevealedToken]=useState<{id:string;name:string;rawToken:string;projectName?:string|null;envVarName?:string}|null>(null);
 const [credentialNotice,setCredentialNotice]=useState<{tokenId:string;text:string}|null>(null);
 const [isLoading,setIsLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const epoch=useRef(new ProjectPageEpoch());
 // An async issuance callback retains this render's selection ticket, even after A -> B -> A.
 const selectionAtRender=epoch.current.selectionTicket();
 const loadData=useCallback(async()=>{
  const ticket=epoch.current.beginRead();setIsLoading(true);setError(null);
  try{
   const [projectResult,tokenResult]=await Promise.all([fetchWorkspaceProjects(),fetchWorkspaceAgentTokens()]);
   if(!epoch.current.acceptsRead(ticket))return;
   if(projectResult.error||tokenResult.error){setError(projectResult.error||tokenResult.error||'Project data unavailable');return;}
   const snapshot=checkedProjectSnapshot(projectResult.projects,tokenResult.tokens);
   if(!snapshot){setError('Invalid project or credential metadata. Previous records are unconfirmed.');return;}
   snapshot.tokens.forEach(t=>{if(t.revoked)epoch.current.noteRevoked(t.id);});
   setProjects(snapshot.projects);setTokens(snapshot.tokens.map(t=>epoch.current.isRevoked(t.id)?{...t,revoked:true}:t));
   setRevealedToken(current=>current&&epoch.current.isRevoked(current.id)?null:current);
   // Reconcile the current selection, never the selection captured when this read began.
   setSelectedProject(current=>current?snapshot.projects.find(p=>p.id===current.id)||null:null);
  }catch(e){if(epoch.current.acceptsRead(ticket))setError(e instanceof Error?e.message:'Project data unavailable');}
  finally{if(epoch.current.acceptsRead(ticket))setIsLoading(false);}
 },[]);
 useEffect(()=>{epoch.current.mount();void loadData();return()=>{epoch.current.unmount();};},[loadData]);
 const handleSelectProject=(project:ProjectResponse|null)=>{
  if(!epoch.current.changeSelection())return;setSelectedProject(project);setRevealedToken(null);
 };
 const handleProjectCreated=(project:ProjectResponse)=>{
  if(!epoch.current.mutationCommitted())return;epoch.current.changeSelection();setIsLoading(false);
  setProjects(current=>[project,...current.filter(p=>p.id!==project.id)]);setSelectedProject(project);setRevealedToken(null);
 };
 const handleTokenIssued=(result:AgentTokenResponse,envVarName?:string)=>{
  if(!epoch.current.mutationCommitted())return;setIsLoading(false);
  const metadata=issuedTokenMetadata(result);if(metadata.revoked)epoch.current.noteRevoked(metadata.id);metadata.revoked=metadata.revoked||epoch.current.isRevoked(metadata.id);setTokens(current=>mergeTokenMetadata(current,metadata));
  if(!epoch.current.acceptsReveal(selectionAtRender,result.id)){
   const revoked=epoch.current.isRevoked(result.id),reason=revoked?'it was already confirmed revoked':'the selection changed';
   const next=revoked?'Its confirmed revoked status is preserved.':'It may still be active. Choose All Projects to inspect and revoke it before deliberately issuing a replacement.';
   setRevealedToken(null);setCredentialNotice({tokenId:result.id,text:'Credential "'+result.name+'" was created, but its one-time secret remains hidden because '+reason+'. Creation was not retried. '+next});
   notify.info(revoked?'Creation finished after credential revocation. Secret hidden; revoked status kept.':'Credential created for the earlier selection. Secret hidden. Check its saved status before issuing another.');return;
  }
  const project=result.projectId?projects.find(p=>p.id===result.projectId):null;
  setRevealedToken({id:result.id,name:result.name,rawToken:result.token,projectName:project?.name||(result.projectId?'Project '+result.projectId:null),envVarName:envVarName||(result.projectId?'LEADLOOM_AGENT_TOKEN':'LEADLOOM_TOOL_TOKEN')});
 };
 const handleTokenRevoked=(id:string)=>{
  if(!epoch.current.mutationCommitted())return;epoch.current.noteRevoked(id);setIsLoading(false);
  setTokens(current=>current.map(t=>t.id===id?{...t,revoked:true}:t));setRevealedToken(current=>current?.id===id?null:current);setCredentialNotice(current=>current?.tokenId===id?null:current);
 };
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-loom/15 border border-brand-loom/30 flex items-center justify-center text-brand-loom">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Projects & Agent Tokens
            </h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Workspace-scoped project registry, project-bound agent credentials, and secure local setup instructions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadData();
            notify.info('Refreshing project data...');
          }}
          disabled={isLoading}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-signal-failed/10 border border-signal-failed/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-signal-failed shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-signal-failed">
              Failed to load projects
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
            <p className="text-xs text-text-muted mt-1">Previously loaded project or credential metadata may be stale. Editors are kept; no mutation was retried automatically.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="text-xs shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {credentialNotice && <div role="status" data-testid="credential-scope-notice" className="rounded-xl border border-signal-catchall/40 bg-canvas-surface p-4 text-xs text-text-secondary"><p>{credentialNotice.text}</p><button type="button" onClick={()=>setCredentialNotice(null)} className="mt-2 text-brand-loom underline">Dismiss notice</button></div>}

      {/* One-time reveal for the unchanged selection only. */}
      {revealedToken && (
        <TokenRevealCard
          tokenName={revealedToken.name}
          rawToken={revealedToken.rawToken}
          projectName={revealedToken.projectName}
          envVarName={revealedToken.envVarName}
          onDismiss={() => setRevealedToken(null)}
        />
      )}

      {/* 2. Actionable Setup Health Preflight */}
      <SetupHealthCard />

      {/* 3. Workspace Project Selector & Creation */}
      <ProjectSelectorCard
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onProjectCreated={handleProjectCreated}
        isLoading={isLoading}
      />

      {selectedProject && <ProjectInventoryCard key={'inventory-'+selectedProject.id} project={selectedProject}/>}
      {selectedProject && <ProjectGrowthReview key={'growth-'+selectedProject.id} project={selectedProject}/>}
      {selectedProject && <ProjectAssets key={'assets-'+selectedProject.id} project={selectedProject} />}
      {selectedProject && <ProjectWorkRecord key={selectedProject.id} project={selectedProject} />}
      {selectedProject && <ProjectSnapshot key={'snapshot-'+selectedProject.id} project={selectedProject}/>}

      {/* 3. Project-Bound Agent Credentials */}
      <AgentTokensCard
        tokens={tokens}
        projects={projects}
        selectedProject={selectedProject}
        onTokenIssued={handleTokenIssued}
        onTokenRevoked={handleTokenRevoked}
        isLoading={isLoading || Boolean(error)}
      />

      {/* 4. Secure Local Setup Instructions */}
      <AgentSetupInstructions
        apiUrl={apiUrl}
        selectedProject={selectedProject}
        issuedToken={revealedToken?.rawToken}
        issuedTokenType={revealedToken?.envVarName}
      />
    </div>
  );
}
