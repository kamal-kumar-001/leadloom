import {it,expect,vi} from 'vitest';import {randomUUID} from 'node:crypto';import {PrismaClient} from '@leadloom/database';
import {CredentialService} from '../../../vault/credential.service';import {PrismaCredentialRepository} from '../../../vault/prisma-credential.repository';import {VaultService} from '../../../vault/vault.service';import {TestConnectionService} from '../test-connection.service';import {createApplication} from '../../../../main';import {issueSession} from '../../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native real vault and HTTP path keep unsupported async probe disabled without changing stored verification',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),key=Buffer.alloc(32,5),old=process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;let app:any;
 try{
  await db.workspace.create({data:{id:ws,name:'Async registry boundary fixture'}});
  const credentials=new CredentialService(new PrismaCredentialRepository(db),new VaultService({currentVersion:1,keys:new Map([[1,Buffer.alloc(32,8)]])})),record=await credentials.save(ws,{provider:'dropcontact',apiKey:'synthetic-only-provider-key',label:'No live request'});
  const before=await db.byokCredential.findUniqueOrThrow({where:{id:record.id}}),fetch=vi.fn(async()=>{throw Error('External transport must not be reached');});vi.stubGlobal('fetch',fetch);process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED='true';
  app=await createApplication({sessionKey:key,credentials,connectorTest:new TestConnectionService()}as any);const server=app.getHttpAdapter().getInstance(),session=issueSession({workspaceId:ws,userId:randomUUID(),role:'admin'},key,3600).token;
  const response=await server.inject({method:'POST',url:'/vault/credentials/dropcontact/test',headers:{authorization:'Bearer '+session}});expect(response.statusCode).toBe(503);expect(response.json()).toMatchObject({status:'DISABLED'});expect(response.body).toContain('reconciliation');expect(response.body).not.toContain('synthetic-only-provider-key');expect(fetch).not.toHaveBeenCalled();expect(await db.byokCredential.findUniqueOrThrow({where:{id:record.id}})).toEqual(before);
  const decrypt=vi.spyOn(credentials,'use');delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;expect((await server.inject({method:'POST',url:'/vault/credentials/dropcontact/test',headers:{authorization:'Bearer '+session}})).statusCode).toBe(503);expect(decrypt).not.toHaveBeenCalled();
 }finally{vi.unstubAllGlobals();if(old===undefined)delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;else process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED=old;await app?.close();await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},15000);
