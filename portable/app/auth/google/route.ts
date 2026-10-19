import {cookies} from 'next/headers';
import {CodeChallengeMethod} from 'google-auth-library';
import {google,token,digest,cookieOptions,throttle,origin} from '../../../server/auth';
import {pool} from '../../../server/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function failure(code:string,message:string,stage:string){
 console.error('Google login initialization failed',{code,stage});
 return new Response(message+'\nReference: '+code,{status:503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
}
export async function GET(){
 let stage='configuration';
 try{
  const required=['APP_ORIGIN','DATABASE_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
  const missing=required.filter(key=>!process.env[key]?.trim());
  if(missing.length)return failure('MISSING_ENV','Missing environment variable(s): '+missing.join(', '),stage);
  try{origin()}catch{return failure('INVALID_APP_ORIGIN','APP_ORIGIN must be the HTTPS website address, for example https://sherlocked2k26-h6kp.vercel.app',stage)}
  const client=google();
  stage='browser-state';
  const jar=await cookies();let browser=jar.get('oauth_browser')?.value;
  if(!browser){browser=token();jar.set('oauth_browser',browser,cookieOptions(600))}
  stage='database-throttle';
  if(!await throttle('oauth:'+digest(browser),20,60000))return new Response('Too many login attempts. Try again shortly.',{status:429,headers:{'Cache-Control':'no-store'}});
  stage='oauth-state';
  const state=token(),nonce=token(),pkce=await client.generateCodeVerifierAsync();
  stage='database-state';
  await pool.query('INSERT INTO auth_states(state_hash,nonce,verifier,browser_hash,expires_at) VALUES ($1,$2,$3,$4,$5)',[digest(state),nonce,pkce.codeVerifier,digest(browser),Date.now()+600000]);
  stage='google-redirect';
  const url=client.generateAuthUrl({scope:['openid','email','profile'],state,nonce,code_challenge:pkce.codeChallenge,code_challenge_method:CodeChallengeMethod.S256,prompt:'select_account'});
  return Response.redirect(url,302);
 }catch(error){
  // Never log raw errors, connection strings, cookies, OAuth codes, or secrets.
  const raw=(error as {code?:unknown})?.code;
  const code=typeof raw==='string'&&/^[A-Z0-9_]{2,50}$/.test(raw)?raw:'LOGIN_INIT_FAILED';
  if(code==='42P01')return failure(code,'Database tables are missing. Run the database migration in the Production build and redeploy.',stage);
  if(code==='28P01')return failure(code,'Database authentication failed. Update DATABASE_URL with the current Neon connection string and redeploy.',stage);
  if(code==='ENOTFOUND'||code==='ECONNREFUSED'||code==='ETIMEDOUT')return failure(code,'Cannot connect to the database. Check DATABASE_URL and the Neon database status.',stage);
  return failure(code,'Login initialization failed during '+stage+'. Check this reference in Vercel Logs.',stage);
 }
}
