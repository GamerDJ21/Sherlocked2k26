import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
process.env.NODE_ENV='production';process.env.APP_ORIGIN='https://event.test';process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';process.env.ADMIN_EMAILS='admin@gmail.com';process.env.ALLOWED_EMAILS='player@gmail.com';
const values=new Map(),writes=[],queries=[];let validState=true,payload,verifyFails=false;
const jar={get:n=>values.has(n)?{value:values.get(n)}:undefined,set(n,v,o){values.set(n,v);writes.push({n,v,o})},delete(n){values.delete(n)}};
const query=async(sql,v=[])=>{queries.push({sql,v});if(sql.startsWith('DELETE FROM auth_states')){const valid=validState&&v[0]===createHash('sha256').update('state').digest('hex')&&v[1]===createHash('sha256').update('browser').digest('hex');validState=false;return {rows:valid?[{nonce:'nonce',verifier:'verifier'}]:[]}}if(sql.startsWith('SELECT u.sub'))return {rows:[{sub:'sub1',email:payload.email,name:'Player'}]};return {rows:[]}};
const pool={query,async connect(){return {query,release(){}}}};
class OAuth2Client{async getToken(v){assert.equal(v.codeVerifier,'verifier');return {tokens:{id_token:'signed-token'}}}async verifyIdToken(v){assert.equal(v.audience,'test-client');if(verifyFails)throw Error('invalid token');return {getPayload:()=>payload}}}
globalThis.authDeps={cookies:async()=>jar,createHash,randomBytes,timingSafeEqual,OAuth2Client,pool};
async function module(file,preamble){let s=fs.readFileSync(file,'utf8').split('\n').filter(l=>!l.startsWith('import ')).join('\n');s=preamble+'\n'+s;const js=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))}
const auth=await module('portable/server/auth.ts','const {cookies,createHash,randomBytes,timingSafeEqual,OAuth2Client,pool}=globalThis.authDeps;');globalThis.callbackDeps={...auth,pool,cookies:async()=>jar};
const callback=await module('portable/app/auth/callback/route.ts','const {cookies,google,digest,token,allowed,cookieName,cookieOptions,origin,equal,pool}=globalThis.callbackDeps;');
const logout=await module('portable/app/api/auth/logout/route.ts','const {cookies,origin,cookieName,cookieOptions,digest,pool}=globalThis.callbackDeps;');
function reset(p={}){values.clear();values.set('oauth_browser','browser');writes.length=0;queries.length=0;validState=true;verifyFails=false;payload={sub:'sub1',email:'player@gmail.com',email_verified:true,nonce:'nonce',name:'Player',...p}}
const request=()=>new Request('https://event.test/auth/callback?state=state&code=code');
reset();values.clear();assert.equal((await callback.GET(request())).status,400);
reset();validState=false;assert.equal((await callback.GET(request())).status,400);
reset({nonce:'wrong'});assert.equal((await callback.GET(request())).status,403);
reset({email_verified:false});assert.equal((await callback.GET(request())).status,403);
reset({email:'stranger@gmail.com'});assert.equal((await callback.GET(request())).status,403);
reset({email:'player@thirdparty.test'});assert.equal((await callback.GET(request())).status,403);
reset();verifyFails=true;assert.equal((await callback.GET(request())).status,401);
reset();const response=await callback.GET(request());assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://event.test/');
const session=writes.find(v=>v.n==='__Host-sherlocked');assert.ok(session);assert.equal(session.o.secure,true);assert.equal(session.o.httpOnly,true);assert.equal(session.o.sameSite,'lax');assert.equal(session.o.path,'/');
const insert=queries.find(q=>q.sql.startsWith('INSERT INTO auth_sessions'));assert.equal(insert.v[0],auth.digest(session.v));assert.notEqual(insert.v[0],session.v);
assert.equal((await callback.GET(request())).status,400);assert.ok(await auth.getUser());process.env.ALLOWED_EMAILS='';assert.equal(await auth.getUser(),null);process.env.ALLOWED_EMAILS='player@gmail.com';
assert.equal((await logout.POST(new Request('https://event.test/api/auth/logout',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);
assert.equal((await logout.POST(new Request('https://event.test/api/auth/logout',{method:'POST',headers:{origin:'https://event.test'}}))).status,200);assert.equal(values.get('__Host-sherlocked'),'');
console.log('PASS: state/browser binding, one-use state, nonce, verified/allowlisted Google account, verifier failure, secure session cookie, hashed session storage, allowlist revocation, logout origin check. Google responses mocked; live OAuth still requires credentials.');
