import {cookies} from 'next/headers';
import {origin,cookieName,cookieOptions,digest} from '../../../../server/auth';
import {pool} from '../../../../server/db';
export const runtime='nodejs';
export async function POST(req:Request){if(req.headers.get('origin')!==origin())return Response.json({error:'Invalid origin'},{status:403});const jar=await cookies(),raw=jar.get(cookieName())?.value;if(raw)await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[digest(raw)]);jar.set(cookieName(),'',cookieOptions(0));return Response.json({ok:true})}
