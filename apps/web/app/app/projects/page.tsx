import ProjectsClient from './projects-client';
import {configuredAgentApiUrl} from '../../../lib/agent-connection-config';
export const dynamic = 'force-dynamic';
export default function ProjectsPage(){
 return <ProjectsClient apiUrl={configuredAgentApiUrl(process.env)} />;
}
