import {createGameHandlers} from '../../../../server/game';
import {db} from '../../../server/db';
import {getUser,origin,throttle} from '../../../server/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function handlers(){return createGameHandlers({DB:db,ADMIN_EMAILS:process.env.ADMIN_EMAILS},getUser)}
export const GET=()=>handlers().GET();
export async function POST(req:Request){if(req.headers.get('origin')!==origin())return Response.json({error:'Invalid origin'},{status:403});const user=await getUser();if(!user)return Response.json({error:'Sign in required'},{status:401});if(!await throttle('game:'+user.userId,100,60000))return Response.json({error:'Too many requests. Try again shortly.'},{status:429});const body=await req.text();if(body.length>16000)return Response.json({error:"Request too large"},{status:413});return handlers().POST(new Request(origin()+"/api/game",{method:"POST",headers:req.headers,body}))}
