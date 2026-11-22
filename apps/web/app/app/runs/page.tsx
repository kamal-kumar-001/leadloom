import React from 'react';
import {currentWebAccess} from '../../../lib/current-web-access';
import {ProjectHistoryBrowser} from '../../../components/runs/project-history-browser';
export const dynamic='force-dynamic';
export default async function RunsPage(){
 const access=await currentWebAccess();
 if(!access.ok)return <p role="alert" className="p-6 text-sm text-text-secondary">{access.error} No saved project history was loaded.</p>;
 return <ProjectHistoryBrowser/>;
}
