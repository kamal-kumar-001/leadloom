import {RELEASE_BUILD_ID} from './release-identity.generated';
export async function runtimeHealth(engineUrl:string,fetcher:typeof fetch=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2000);
 try{
  const response=await fetcher(engineUrl.replace(/\/+$/,'')+'/health',{signal:controller.signal,redirect:'manual',cache:'no-store'});
  if(response.status!==200||!response.body)return false;
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)return false;chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return body?.status==='ok'&&body?.service==='leadloom-engine'&&body?.mutationsEnabled===true&&body?.buildId===RELEASE_BUILD_ID&&/^[a-f0-9]{64}$/.test(RELEASE_BUILD_ID);
 }catch{return false;}finally{clearTimeout(timer);}
}
