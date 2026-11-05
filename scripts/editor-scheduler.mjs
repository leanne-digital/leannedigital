import {EditorStore} from '../server/editor/store.mjs';
if(!process.env.WEBSITE_EDITOR_DATA_DIR)throw Error('Set WEBSITE_EDITOR_DATA_DIR');
const store=new EditorStore(process.env.WEBSITE_EDITOR_DATA_DIR);
try{console.log(JSON.stringify({jobs:store.runSchedules()}));}finally{store.close();}
