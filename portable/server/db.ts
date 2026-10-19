import pg from 'pg';
import type {GameDatabase,GameStatement} from '../../server/game';
pg.types.setTypeParser(20,Number);
pg.types.setTypeParser(1700,Number);
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
function convert(sql:string){let n=0;let q=sql.replace(/\?/g,()=>'$'+(++n));if(q.startsWith('INSERT OR IGNORE '))q=q.replace('INSERT OR IGNORE ','INSERT ')+' ON CONFLICT DO NOTHING';return q.replace(/\btotalTime\b/g,'"totalTime"')}
function statement(sql:string,values:any[]=[]):GameStatement&{sql:string;values:any[]}{return {sql:convert(sql),values,bind(...v:any[]){return statement(sql,v)},async first<T>(){const r=await pool.query(convert(sql),values);return (r.rows[0]??null) as T|null},async all<T>(){const r=await pool.query(convert(sql),values);return {results:r.rows as T[]}},async run(){return pool.query(convert(sql),values)}}}
export const db:GameDatabase={prepare:statement,async batch(statements){const client=await pool.connect();try{await client.query('BEGIN');const results=[];for(const s of statements){const v=s as ReturnType<typeof statement>;results.push(await client.query(v.sql,v.values))}await client.query('COMMIT');return results}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
