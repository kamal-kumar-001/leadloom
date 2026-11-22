import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DmpilotHandoffPreview} from '../../components/projects/dmpilot-handoff-preview';
const copy={instagramAccountId:'fixture-account',mediaUrl:'https://cdn.example.org/photo.jpg',mediaType:'IMAGE',caption:'Exact <script>not executed</script> words',scheduledAt:null};
const handoff=(value:any)=>({schema:'leadloom-dmpilot-post-handoff-v1',state:'private_handoff',productBrief:{assetId:'11111111-1111-4111-8111-111111111111',version:1},copy:value,copyDigest:'a'.repeat(64),dmpilotRequest:{...value,scheduledAt:undefined,dryRun:true,clientRequestId:'22222222-2222-4222-8222-222222222222'},limits:['Private only']});
const asset=(body:any)=>({version:2,body:JSON.stringify(body)} as any);
describe('saved DMPilot handoff preview',()=>{
 it('shows exact saved copy and the account/time/publication boundary, without a publish control',()=>{const html=renderToStaticMarkup(<DmpilotHandoffPreview asset={asset(handoff(copy))}/>);expect(html).toContain('version 2');expect(html).toContain('fixture-account');expect(html).toContain('eligibility unchecked');expect(html).toContain('Exact &lt;script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('not unsaved editor changes');expect(html).toContain('No automatic publication');expect(html).not.toContain('<button');});
 it('labels a caller-supplied preview as unverified, not approved or authenticated execution',()=>{const html=renderToStaticMarkup(<DmpilotHandoffPreview asset={asset({schema:'leadloom-dmpilot-reported-preview-v1',reportedPreview:{dryRun:true,draftOnly:true,wouldPublish:{...copy,username:'reported_handle'}}})}/>);expect(html).toContain('Unverified caller-reported preview');expect(html).toContain('not authenticated');expect(html).toContain('Not human approval');expect(html).not.toContain('Publish now');});
 it('does not render ordinary, malformed, unsupported or unsafe-link bodies',()=>{for(const body of [{schema:'other',copy},{schema:'leadloom-dmpilot-post-handoff-v1',copy:{...copy,mediaType:'CAROUSEL'}},{schema:'leadloom-dmpilot-post-handoff-v1',copy:{...copy,mediaUrl:'javascript:alert(1)'}}])expect(renderToStaticMarkup(<DmpilotHandoffPreview asset={asset(body)}/>)).toBe('');expect(renderToStaticMarkup(<DmpilotHandoffPreview asset={null}/>)).toBe('');});
});
