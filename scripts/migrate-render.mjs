import fs from 'node:fs';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),c=await pool.connect();
try{
 await c.query('SELECT pg_advisory_lock(2212026)');
 await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at bigint NOT NULL)');
 for(const name of fs.readdirSync('drizzle').filter(v=>v.endsWith('.sql')).sort()){
  if((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;
  const sql=fs.readFileSync('drizzle/'+name,'utf8').replaceAll('`','"').replace(/\binteger\b/gi,'bigint').replaceAll('--> statement-breakpoint','');
  await c.query('BEGIN');try{await c.query(sql);await c.query('INSERT INTO schema_migrations(name,applied_at) VALUES ($1,$2)',[name,Date.now()]);await c.query('COMMIT');console.log('Applied '+name)}catch(e){await c.query('ROLLBACK');throw e}
 }
 await c.query(`CREATE TABLE IF NOT EXISTS auth_users(sub text PRIMARY KEY,email text NOT NULL,name text NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES auth_users(sub),expires_at bigint NOT NULL);
 CREATE INDEX IF NOT EXISTS auth_session_user ON auth_sessions(user_id);
 CREATE TABLE IF NOT EXISTS auth_states(state_hash text PRIMARY KEY,nonce text NOT NULL,verifier text NOT NULL,browser_hash text NOT NULL,expires_at bigint NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_limits(id text PRIMARY KEY,bucket bigint NOT NULL,hits integer NOT NULL);`);
 await c.query('DELETE FROM auth_sessions WHERE expires_at<$1',[Date.now()]);await c.query('DELETE FROM auth_states WHERE expires_at<$1',[Date.now()]);
 console.log('PostgreSQL schema ready.');
}finally{await c.query('SELECT pg_advisory_unlock(2212026)');c.release();await pool.end()}
