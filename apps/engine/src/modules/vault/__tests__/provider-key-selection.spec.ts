import {describe,it,expect,vi} from 'vitest';
import {PrismaCredentialRepository} from '../prisma-credential.repository';
describe('native credential selection query',()=>{
 it('uses the same tenant-scoped native timestamp/id order for selected key and metadata list',async()=>{
  const findFirst=vi.fn().mockResolvedValue(null),findMany=vi.fn().mockResolvedValue([]);
  const repo=new PrismaCredentialRepository({byokCredential:{findFirst,findMany}} as any);
  expect(await repo.findLatestByProvider('workspace-a','openai')).toBeNull();
  expect(await repo.list('workspace-a')).toEqual([]);
  const orderBy=[{createdAt:'desc'},{id:'desc'}];
  expect(findFirst).toHaveBeenCalledWith({where:{workspaceId:'workspace-a',provider:'openai'},orderBy});
  expect(findMany).toHaveBeenCalledWith({where:{workspaceId:'workspace-a'},orderBy});
 });
});
