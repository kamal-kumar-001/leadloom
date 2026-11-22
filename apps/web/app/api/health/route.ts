import {RELEASE_BUILD_ID} from '../../../lib/release-identity.generated';
import {NextResponse} from 'next/server';
import {engineBase} from '../../../lib/engine-server';
import {runtimeHealth} from '../../../lib/runtime-health';
export const dynamic='force-dynamic';
/** Liveness and web-to-engine reachability only. Not login, provider or send readiness. */
export async function GET(){
 const engineReachable=await runtimeHealth(engineBase());
 return NextResponse.json({status:engineReachable?'ok':'unavailable',service:'leadloom-web',buildId:RELEASE_BUILD_ID,engineReachable},{status:engineReachable?200:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
