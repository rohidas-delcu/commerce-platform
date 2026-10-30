import {randomBytes} from 'node:crypto';
import {readFile,writeFile,appendFile,chmod} from 'node:fs/promises';
const path = new URL('../apps/api/.env', import.meta.url);
if (process.env.NODE_ENV === 'production') throw new Error('Development initialization is forbidden in production.');
let content;
try {content=await readFile(path,'utf8');} catch(error) {
  if(error.code!=='ENOENT') throw error;
  content=await readFile(new URL('../.env.example',import.meta.url),'utf8');
  await writeFile(path,content,{flag:'wx',mode:0o600});
}
if (!/^AUTH_OUTBOX_KEY=.+$/m.test(content)) {
  await appendFile(path,`\nAUTH_OUTBOX_KEY=${randomBytes(32).toString('hex')}\n`);
  await chmod(path,0o600);
}
console.log('Development environment file prepared; existing settings preserved. No secrets printed.');
