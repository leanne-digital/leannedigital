import http from 'node:http';
import path from 'node:path';
import { EditorStore } from '../server/editor/store.mjs';
import { handleEditor } from '../server/editor/http.mjs';
const store=new EditorStore(process.env.WEBSITE_EDITOR_DATA_DIR||path.resolve('runtime/website-editor'));
process.env.WEBSITE_EDITOR_ORIGIN ||= 'http://127.0.0.1:'+(process.env.EDITOR_PORT||4186);
const timer=setInterval(()=>{try{store.runSchedules();}catch(e){console.error('Scheduler failed',e.code||e.message);}},10000);timer.unref();
const server=http.createServer(async(req,res)=>{if(!await handleEditor(req,res,{store,assets:true})){res.writeHead(404);res.end('Private editor preview. Sign in at /editor/login');}});
server.listen(Number(process.env.EDITOR_PORT||4186),'127.0.0.1',()=>console.log('Private editor preview: http://127.0.0.1:'+server.address().port+'/editor/login'));
