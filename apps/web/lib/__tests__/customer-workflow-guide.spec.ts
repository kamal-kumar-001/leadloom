import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {HelpGuideModal} from '../../components/shell/help-guide-modal';
import {CUSTOMER_WORKFLOW_STEPS,CUSTOMER_WORKFLOW_BOUNDARY} from '../customer-workflow-guide';
describe('project-first customer workflow guide',()=>{
 it('starts with the customer project/coding agent and covers the preparation lifecycle',()=>{expect(CUSTOMER_WORKFLOW_STEPS.map(s=>s.key)).toEqual(['project','research','build','validation','outreach','growth']);expect(CUSTOMER_WORKFLOW_STEPS[0].links[0].href).toBe('/app/projects');expect(CUSTOMER_WORKFLOW_BOUNDARY).toContain('without a provider key or connected mailbox');});
 it('renders every explicit internal navigation link and closes without making an action request',()=>{const html=renderToStaticMarkup(React.createElement(HelpGuideModal,{isOpen:true,onClose:()=>{}}));for(const step of CUSTOMER_WORKFLOW_STEPS){expect(html).toContain(step.title.replaceAll('&','&amp;'));for(const link of step.links){expect(link.href).toMatch(/^\/app(?:\/[-a-z]+)?$/);expect(html).toContain('href="'+link.href+'"');}}expect(html).toContain('does not approve publication');expect(html).not.toContain('Store BYOK Provider Keys');});
 it('renders nothing while closed',()=>{expect(renderToStaticMarkup(React.createElement(HelpGuideModal,{isOpen:false,onClose:()=>{}}))).toBe('');});
});
