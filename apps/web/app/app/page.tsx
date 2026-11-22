'use client';
import React,{useState,useEffect,useCallback,useRef} from 'react';
import {fetchAuthMe,fetchWorkspaceSummary,fetchWorkspaceProjects,type WorkspaceSummary} from '../../lib/engine-client';
import {isPlatformAdmin} from '../../lib/platform-admin';
import {checkedWorkspaceSummary,projectRecordStatus,summaryRecordStatus,type RecordStatus} from '../../lib/dashboard-record-status';
import {DashboardHeader,type UserWorkspaceInfo,StatCardsGrid,type CardState,GettingStartedChecklist,EmptyVaultCard} from '../../components/dashboard';
export default function AppPage(){
 const [userInfo,setUserInfo]=useState<UserWorkspaceInfo|null>(null),[userLoading,setUserLoading]=useState(true),[userError,setUserError]=useState<string|null>(null);
 const [projectStatus,setProjectStatus]=useState<RecordStatus>('loading');
 const [summaryState,setSummaryState]=useState<CardState<WorkspaceSummary>>({data:null,isLoading:true,error:null});
 const identityGeneration=useRef(0),summaryGeneration=useRef(0);
 const loadUserInfo=useCallback(async()=>{
  const generation=++identityGeneration.current;setUserLoading(true);setUserError(null);setUserInfo(null);
  try{
   const [meRes,sessionRes]=await Promise.all([fetchAuthMe(),fetch('/api/auth/session').then(r=>r.ok?r.json():null).catch(()=>null)]);
   if(generation!==identityGeneration.current)return;
   if(meRes.data){const sessionUser=sessionRes?.user;setUserInfo({userId:meRes.data.userId,name:meRes.data.name??sessionUser?.name??null,workspaceId:meRes.data.workspaceId,role:meRes.data.role,email:sessionUser?.email||null,isPlatformAdmin:sessionUser?isPlatformAdmin(sessionUser):false});}
   else setUserError(meRes.error||'Failed to retrieve workspace identity');
  }catch(error){if(generation===identityGeneration.current)setUserError(error instanceof Error?error.message:'Workspace identity unavailable');}
  finally{if(generation===identityGeneration.current)setUserLoading(false);}
 },[]);
 const loadSummary=useCallback(async()=>{
  const generation=++summaryGeneration.current;setSummaryState({data:null,isLoading:true,error:null});setProjectStatus('loading');
  const [summary,projects]=await Promise.allSettled([fetchWorkspaceSummary(),fetchWorkspaceProjects()]);
  if(generation!==summaryGeneration.current)return;
  setProjectStatus(projects.status==='fulfilled'?projectRecordStatus(projects.value):'unavailable');
  if(summary.status==='fulfilled'&&!summary.value.error){const data=checkedWorkspaceSummary(summary.value.data);setSummaryState({data,isLoading:false,error:data?null:'Invalid workspace summary. No counts displayed.'});}
  else setSummaryState({data:null,isLoading:false,error:summary.status==='fulfilled'?summary.value.error||'Workspace summary unavailable':'Workspace summary unavailable'});
 },[]);
 useEffect(()=>{void loadUserInfo();void loadSummary();return()=>{identityGeneration.current++;summaryGeneration.current++;};},[loadUserInfo,loadSummary]);
 return <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
  <DashboardHeader info={userInfo} isLoading={userLoading} error={userError} onRetry={loadUserInfo}/>
  <div className="flex justify-end"><button type="button" onClick={()=>void loadSummary()} className="rounded border border-border-subtle px-3 py-2 text-xs text-text-primary">Refresh workspace records</button></div>
  <StatCardsGrid summaryState={summaryState} onRetry={loadSummary}/>
  <GettingStartedChecklist projectStatus={projectStatus} providerKeyStatus={summaryRecordStatus(summaryState,'providerKeys')} mailboxStatus={summaryRecordStatus(summaryState,'mailboxes')} tableStatus={summaryRecordStatus(summaryState,'tables')}/>
  {!summaryState.isLoading&&!summaryState.error&&summaryState.data?.providerKeys===0&&<EmptyVaultCard/>}
 </div>;
}
