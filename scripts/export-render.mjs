import fs from 'node:fs';import path from 'node:path';
const name=process.argv[2]||'render-source';if(!/^[a-z0-9-]+$/.test(name))throw Error('Use a simple export directory name');
const root=process.cwd(),target=path.join(root,'outputs',name);
if(fs.existsSync(target))throw Error('Export directory already exists; choose a fresh output directory before exporting again.');fs.mkdirSync(target,{recursive:true});
const entries=['.gitignore','app','server','portable','scripts','db','drizzle','public','package.json','package-lock.json','render.yaml','DEPLOYMENT.md','README.md','.env.example','postcss.config.mjs','tsconfig.json'];
for(const entry of entries){const p=path.join(root,entry);if(!fs.existsSync(p))continue;fs.cpSync(p,path.join(target,entry),{recursive:true,filter:file=>(!['.next','node_modules','.sites-runtime','.wrangler','.dev.vars','.git','tsconfig.tsbuildinfo'].includes(path.basename(file))&&!path.basename(file).startsWith('.env'))||path.basename(file)==='.env.example'});}
console.log(target);
