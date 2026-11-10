import { describe,it,expect } from 'vitest';
import { DAGRunnerService } from '../dag-runner.service';
import { MockProviderAdapter } from '../adapters/mock.adapter';
const nodes=[{id:'n',provider:'apollo' as const,tier:1}];
const setup=()=>{
 const runner=new DAGRunnerService(),adapter=new MockProviderAdapter({provider:'apollo',nominalCostMicrocents:100,simulatedStatus:'hit',simulatedVerification:'deliverable',simulatedEmail:'synthetic@example.invalid'});
 runner.registerAdapter(adapter);return {runner,adapter};
};
describe('Cross-team integration regressions',()=>{
 it('does not reuse one person email for a different person at the same domain',async()=>{
  const {runner,adapter}=setup();
  await runner.executeRow({domain:'example.invalid',workspaceId:'a',firstName:'Alice'},nodes);
  await runner.executeRow({domain:'example.invalid',workspaceId:'a',firstName:'Bob'},nodes);
  expect(adapter.callCount).toBe(2);
 });
 it('does not reuse personal lookup data across tenant boundaries',async()=>{
  const {runner,adapter}=setup();
  await runner.executeRow({domain:'example.invalid',workspaceId:'a'},nodes);
  await runner.executeRow({domain:'example.invalid',workspaceId:'b'},nodes);
  expect(adapter.callCount).toBe(2);
 });
 it('disables personal-result cache without authenticated tenant scope',async()=>{
  const {runner,adapter}=setup();
  await runner.executeRow({domain:'example.invalid'},nodes);await runner.executeRow({domain:'example.invalid'},nodes);
  expect(adapter.callCount).toBe(2);
 });
 it('rejects duplicate DAG node identifiers',()=>{
  expect(()=>setup().runner.sortNodes([nodes[0],nodes[0]])).toThrow('Duplicate');
 });
 it('does not label an empty configuration as rate-limited',async()=>{
  const result=await setup().runner.executeRow({domain:'example.invalid'},[]);
  expect(result.status).toBe('exhausted');
 });
 it('contains adapter failures and does not expose raw errors',async()=>{
  const {runner,adapter}=setup(); adapter.execute=async()=>{throw new Error('synthetic-secret-in-provider-error');};
  const result=await runner.executeRow({domain:'example.invalid'},nodes);
  expect(result.trace[0].status).toBe('error'); expect(JSON.stringify(result)).not.toContain('synthetic-secret');
 });
});
