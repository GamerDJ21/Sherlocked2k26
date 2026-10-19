export type GameUser={userId:string;email:string;displayName:string};
export interface GameStatement {bind(...values:any[]):GameStatement;first<T=any>():Promise<T|null>;all<T=any>():Promise<{results:T[]}>;run():Promise<any>}
export interface GameDatabase {prepare(sql:string):GameStatement;batch(statements:GameStatement[]):Promise<any>}
export function createGameHandlers(env:{DB?:GameDatabase;ADMIN_EMAILS?:string},getChatGPTUser:()=>Promise<GameUser|null>){
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const normalize=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function str(v:unknown,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid input');return v.trim();}
const isAdmin=(email:string)=>((env as any).ADMIN_EMAILS||'').split(',').map((s:string)=>s.trim().toLowerCase()).includes(email.toLowerCase());
// Keep legacy team records intact; solo identities never share scores or invitation codes.
async function participant(db:GameDatabase,u:{userId:string;displayName:string}){
 const id='solo:'+u.userId,name=u.displayName.split('@')[0]+' · '+(await hash(u.userId)).slice(0,12);
 await db.prepare('INSERT INTO teams(id,name,code) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(id,name,crypto.randomUUID()).run();
 return {id,name};
}
async function GET(){try{
 const u=await getChatGPTUser();if(!u)return json({error:'Sign in to enter'},401);const db=env.DB;if(!db)return json({error:'Database unavailable'},503);
 const admin=isAdmin(u.email),player=await participant(db,u);
 const questions=await db.prepare('SELECT id,title,'+(admin?'prompt,options,':'')+'format,points,published,opens,closes FROM questions '+(admin?'WHERE published>=0':'WHERE published=1 AND opens<=?')).bind(...(admin?[]:[Date.now()])).all();
 const removed=admin?await db.prepare('SELECT id,title FROM questions WHERE published=-1').all():{results:[]};
 const board=await db.prepare("SELECT t.id,t.name,COALESCE(SUM(s.points),0) score,COUNT(s.id) solved,CASE WHEN COUNT(s.id)=COUNT(s.duration) THEN COALESCE(SUM(s.duration),0) ELSE NULL END totalTime FROM teams t LEFT JOIN solves s ON s.team=t.id WHERE t.id LIKE 'solo:%' GROUP BY t.id ORDER BY score DESC,COALESCE(CASE WHEN COUNT(s.id)=COUNT(s.duration) THEN SUM(s.duration) ELSE NULL END,9223372036854775807),t.name").all();
 const timings=await db.prepare("SELECT team,question,duration,at FROM solves WHERE team LIKE 'solo:%'").all();
 const solved=await db.prepare('SELECT question FROM solves WHERE team=?').bind(player.id).all();
 const tracking=admin?await db.prepare('SELECT t.id,t.name,e.kind,e.question,e.at FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY team ORDER BY at DESC) rn FROM events) e JOIN teams t ON t.id=e.team WHERE e.rn<=50 ORDER BY e.at DESC').all():{results:[]};
 const logs=admin?await db.prepare('SELECT t.id,t.name,a.question,a.answer,a.correct,a.at FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY team ORDER BY at DESC) rn FROM attempts) a JOIN teams t ON t.id=a.team WHERE a.rn<=50 ORDER BY a.at DESC').all():{results:[]};
 return json({user:u.displayName,admin,participant:player,questions:questions.results,removedQuestions:removed.results,leaderboard:board.results,timings:timings.results,solved:solved.results,tracking:tracking.results,logs:logs.results,now:Date.now()});
 }catch{return json({error:'Unable to load. Check database migrations.'},503);}}
async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 const raw=await req.text();if(raw.length>16000)return json({error:'Request too large'},413);const b=JSON.parse(raw);
 const u=await getChatGPTUser();if(!u)return json({error:'Sign in required'},401);const db=env.DB;if(!db)return json({error:'Database unavailable'},503);
 const now=Date.now(),admin=isAdmin(u.email);
 const rate=await db.prepare('INSERT INTO throttles(id,at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at WHERE throttles.at<? RETURNING id').bind(u.userId+':'+(b.action==='event'?'event':b.action==='openQuestion'?'open':'mutation'),now,now-1500).first();if(!rate)return json({error:'Please wait a moment'},429);
 if(b.action==='createTeam'||b.action==='joinTeam'){
  return json({error:'This is an individual event. Team enrollment is disabled.'},410);
 }
 if(b.action==='removeQuestion'||b.action==='restoreQuestion'){
  if(!admin)return json({error:'Admin access required'},403);const id=str(b.id,100);
  const changed=await db.prepare('UPDATE questions SET published=? WHERE id=? RETURNING id').bind(b.action==='removeQuestion'?-1:0,id).first();
  if(!changed)return json({error:'Question not found'},404);
  return json({message:b.action==='removeQuestion'?'Question removed. Scores and audit history are preserved.':'Question restored as a draft.'});
 }
 if(b.action==='saveQuestion'){
  if(b.id&&await db.prepare('SELECT id FROM questions WHERE id=? AND published=-1').bind(str(b.id,100)).first())return json({error:'Restore the removed question before editing it.'},409);
  if(!admin)return json({error:'Admin access required'},403);const id=b.id?str(b.id,100):crypto.randomUUID();
  if(await db.prepare('SELECT id FROM question_starts WHERE question=? LIMIT 1').bind(id).first()||await db.prepare('SELECT id FROM attempts WHERE question=? LIMIT 1').bind(id).first())return json({error:'Questions lock once opened. Create a new case.'},409);
  if(!['text','mcq','number'].includes(b.format)||!Number.isInteger(b.points)||b.points<1||b.points>10000||!Number.isSafeInteger(b.opens)||!Number.isSafeInteger(b.closes)||b.closes<=b.opens)throw Error('Invalid settings');
  const options=b.format==='mcq'?str(b.options,2000).split('\n').map((s:string)=>s.trim()).filter(Boolean):[];const answer=str(b.answer,500);
  if(b.format==='mcq'&&(options.length<2||options.length>8||!options.includes(answer)))throw Error('Invalid options or answer');if(b.format==='number'&&!Number.isFinite(Number(answer)))throw Error('Invalid numeric answer');
  await db.prepare('INSERT INTO questions(id,title,prompt,format,options,answer,points,published,opens,closes) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,prompt=excluded.prompt,format=excluded.format,options=excluded.options,answer=excluded.answer,points=excluded.points,published=excluded.published,opens=excluded.opens,closes=excluded.closes').bind(id,str(b.title,100),str(b.prompt,5000),b.format,JSON.stringify(options),await hash(id+':'+(b.format==='number'?String(Number(answer)):normalize(answer))),b.points,b.published?1:0,b.opens,b.closes).run();return json({message:'Case file saved'});
 }
 const player=await participant(db,u),m={team:player.id};
 if(b.action==='openQuestion'){
  const q=await db.prepare('SELECT id,title,prompt,format,options,points,published,opens,closes FROM questions WHERE id=? AND published=1 AND opens<=?').bind(str(b.question,100),now).first<any>();
  if(!q)return json({error:'Case unavailable or not yet open'},409);
  const done=await db.prepare('SELECT duration FROM solves WHERE team=? AND question=?').bind(m.team,q.id).first<any>();
  if(now>=q.closes&&!done)return json({error:'Time has expired'},409);
  await db.batch([db.prepare('INSERT OR IGNORE INTO question_starts(id,team,question,at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),m.team,q.id,now),db.prepare('INSERT INTO events(id,team,kind,question,at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),m.team,'question_opened',q.id,now)]);
  const start=await db.prepare('SELECT at FROM question_starts WHERE team=? AND question=?').bind(m.team,q.id).first<any>();
  return json({question:{...q,startedAt:start.at,duration:done?.duration??null},now});
 }
 if(b.action==='event'){if(!['heartbeat','page_hidden','page_visible'].includes(b.kind))throw Error('Invalid event');await db.prepare('INSERT INTO events(id,team,kind,question,at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),m.team,b.kind,typeof b.question==='string'?b.question.slice(0,100):'',now).run();return json({ok:true});}
 if(b.action==='answer'){
  const q=await db.prepare('SELECT * FROM questions WHERE id=? AND published=1 AND opens<=? AND closes>?').bind(str(b.question,100),now,now).first<any>();if(!q)return json({error:'Case unavailable or time expired'},409);
  const start=await db.prepare('SELECT at FROM question_starts WHERE team=? AND question=?').bind(m.team,q.id).first<any>();if(!start)return json({error:'Open this case before submitting an answer'},409);
  if(await db.prepare('SELECT id FROM attempts WHERE team=? AND question=? AND at>? LIMIT 1').bind(m.team,q.id,now-5000).first())return json({error:'Wait five seconds between attempts'},429);
  const answer=str(b.answer,500),canonical=q.format==='number'?(Number.isFinite(Number(answer))?String(Number(answer)):'invalid'):normalize(answer),correct=await hash(q.id+':'+canonical)===q.answer;
  await db.batch([db.prepare('INSERT INTO attempts(id,team,question,answer,correct,at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),m.team,q.id,answer,correct?1:0,now),...(correct?[db.prepare('INSERT OR IGNORE INTO solves(id,team,question,points,at,duration) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),m.team,q.id,q.points,now,Math.max(0,now-start.at))]:[])]);return json({message:correct?'Case solved. Points secured.':'That lead went cold. Try again.',correct});
 }
 return json({error:'Unknown action'},400);
 }catch(e){return json({error:e instanceof Error&&e.message.startsWith('Invalid')?e.message:'Could not save. Check your input or try again.'},400);}}

return {GET,POST};
}
