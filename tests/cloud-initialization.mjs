import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=['syncCloudNow','handleCloudSession'].map(name=>html.match(new RegExp('  async function '+name+'\\(.*[^\\r\\n]+'))[0]).join('\n')+'\n'+html.slice(html.indexOf('  async function reconcileCloud()'),html.indexOf('  function queueCloudSave('));
for(const mode of ['empty','conflict','retry']){
 let reads=0,uploads=0,activations=0,conflicts=0;
 const local={students:mode==='conflict'?[{id:'local'}]:[],grades:[]},remote={revision:7,payload:{students:[{id:'remote'}],grades:[]}};
 const env={storageError:'',savingLocal:false,cloudUser:{id:'u',email:'school@test'},CLOUD_EMAIL:'school@test',cloudConflict:null,cloudAuthPromise:null,cloudQueue:Promise.resolve(),cloudBase:null,cloudRevision:null,cloudReady:false,db:local,
  hashDB:async v=>JSON.stringify(v),readCloudMeta:()=>null,clone:structuredClone,validateDB:v=>v,blankDB:v=>!v.students.length,
  fetchCloudRow:async()=>{if(mode==='retry'&&reads++===0)throw Error('Read failed');return remote;},
  uploadLocal:async()=>{uploads++;},activateCloud:async()=>{activations++;},enterCloudConflict:()=>{conflicts++;},notify:()=>{},showCloudGate:()=>{},cloudStatus:()=>{},render:()=>{}};
 const context=vm.createContext(env);vm.runInContext(source,context);await vm.runInContext('syncCloudNow()',context);
 if(mode==='retry'){assert.equal(activations,0);await vm.runInContext('syncCloudNow()',context);}
 assert.equal(uploads,0);assert.equal(activations,mode==='conflict'?0:1);assert.equal(conflicts,mode==='conflict'?1:0);
}
console.log('PASS: unknown cloud revision hydrates or requests reconciliation; read failure can retry without deleting remote students.');
