import {cookies} from 'next/headers';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {pool} from './db';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export function origin(){const value=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL;if(!value)throw Error('APP_ORIGIN is required');const url=new URL(value);if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('HTTPS is required');return url.origin}
export function secure(){return origin().startsWith('https:')}
export function cookieName(){return secure()?'__Host-sherlocked':'sherlocked'}
export function cookieOptions(maxAge:number){return {httpOnly:true,secure:secure(),sameSite:'lax' as const,path:'/',maxAge}}
export function google(){if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw Error('Google login has not been configured');return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,origin()+'/auth/callback')}
export function allowed(email:string){const list=[process.env.ADMIN_EMAILS||'',process.env.ALLOWED_EMAILS||''].join(',').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);return list.includes(email.toLowerCase())}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export async function getUser(){const jar=await cookies(),raw=jar.get(cookieName())?.value;if(!raw)return null;const r=await pool.query('SELECT u.sub,u.email,u.name FROM auth_sessions s JOIN auth_users u ON u.sub=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2',[digest(raw),Date.now()]);const u=r.rows[0];if(!u||!allowed(u.email))return null;return {userId:u.sub,email:u.email,displayName:u.name};}
export async function throttle(key:string,limit:number,window:number){const bucket=Math.floor(Date.now()/window);const r=await pool.query('INSERT INTO auth_limits(id,bucket,hits) VALUES ($1,$2,1) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN auth_limits.bucket=excluded.bucket THEN auth_limits.hits+1 ELSE 1 END,bucket=excluded.bucket RETURNING hits',[key,bucket]);return r.rows[0].hits<=limit}
