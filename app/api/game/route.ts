import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {createGameHandlers} from '../../../server/game';
export const dynamic='force-dynamic';
const handlers=()=>createGameHandlers({DB:env.DB,ADMIN_EMAILS:(env as any).ADMIN_EMAILS},getChatGPTUser);
export const GET=()=>handlers().GET();
export const POST=(req:Request)=>handlers().POST(req);
