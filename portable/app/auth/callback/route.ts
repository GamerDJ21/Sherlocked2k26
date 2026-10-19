import {cookies} from 'next/headers';
import {google,digest,token,allowed,cookieName,cookieOptions,origin,equal} from '../../../server/auth';
import {pool} from '../../../server/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const url=new URL(req.url),state=url.searchParams.get('state'),code=url.searchParams.get('code'),jar=await cookies(),browser=jar.get('oauth_browser')?.value;
 if(!state||!code||!browser)return new Response('Login expired or cancelled. Please start again.',{status:400});
 const found=await pool.query('DELETE FROM auth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>$3 RETURNING *',[digest(state),digest(browser),Date.now()]);const saved=found.rows[0];if(!saved)return new Response('Invalid or expired login. Please start again.',{status:400});
 const client=google(),{tokens}=await client.getToken({code,codeVerifier:saved.verifier});if(!tokens.id_token)return new Response('Google identity missing.',{status:401});
 const ticket=await client.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID});const p=ticket.getPayload();
 if(!p?.sub||!p.email||!p.email_verified||!equal(String(p.nonce||''),saved.nonce)||(!p.email.endsWith('@gmail.com')&&!p.hd))return new Response('Use an approved Gmail or Google Workspace account.',{status:403});
 if(!allowed(p.email))return new Response('This Google account is not on the participant list. Contact the organizer.',{status:403});
 const raw=token(),expires=Date.now()+8*60*60*1000;const c=await pool.connect();try{await c.query('BEGIN');await c.query('INSERT INTO auth_users(sub,email,name) VALUES ($1,$2,$3) ON CONFLICT(sub) DO UPDATE SET email=excluded.email,name=excluded.name',[p.sub,p.email.toLowerCase(),p.name||p.email.split('@')[0]]);await c.query('DELETE FROM auth_sessions WHERE user_id=$1',[p.sub]);await c.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[digest(raw),p.sub,expires]);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 jar.set(cookieName(),raw,cookieOptions(8*60*60));jar.delete('oauth_browser');
 return Response.redirect(origin(),302);
 }catch{return new Response('Sign-in failed. Please start again from the login page.',{status:401})}}
