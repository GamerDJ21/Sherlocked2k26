import {cookies} from 'next/headers';
import {CodeChallengeMethod} from 'google-auth-library';
import {google,token,digest,cookieOptions,throttle} from '../../../server/auth';
import {pool} from '../../../server/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{
 const jar=await cookies();let browser=jar.get('oauth_browser')?.value;if(!browser){browser=token();jar.set('oauth_browser',browser,cookieOptions(600))}
 if(!await throttle('oauth:'+digest(browser),20,60000))return new Response('Too many login attempts. Try again shortly.',{status:429});
 const client=google(),state=token(),nonce=token(),pkce=await client.generateCodeVerifierAsync();
 await pool.query('INSERT INTO auth_states(state_hash,nonce,verifier,browser_hash,expires_at) VALUES ($1,$2,$3,$4,$5)',[digest(state),nonce,pkce.codeVerifier,digest(browser),Date.now()+600000]);
 const url=client.generateAuthUrl({scope:['openid','email','profile'],state,nonce,code_challenge:pkce.codeChallenge,code_challenge_method:CodeChallengeMethod.S256,prompt:'select_account'});
 return Response.redirect(url,302);
 }catch{return new Response('Google login is not configured yet. Contact the organizer.',{status:503})}}
