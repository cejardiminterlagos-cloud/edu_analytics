const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8');
 const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.referenceYear=2026;
 seed.students=[{id:'s1',registration:'001',name:'Teste Auditoria',group:'8º Ano A',series:'8EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}];
 seed.grades=[{year:2026,registration:'001',name:'Teste Auditoria',group:'8º Ano A',discipline:'Arte',notes:[8,8,8]}];
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
  await p.addInitScript(seed=>{if(!sessionStorage.seeded){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));sessionStorage.seeded='1';}},seed);
  const rootEntry=path.resolve(__dirname,'../../index.html');
  await p.goto(pathToFileURL(fs.existsSync(rootEntry)?rootEntry:app).href+'#seliga');
  assert.equal(p.url(),pathToFileURL(app).href+'#seliga');await p.locator('[data-action=cloud-local-only]').click();
  assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Sem Nota/);
  await p.locator('#grades-group').selectOption('8º Ano A');
  await p.getByText('Lista completa de disciplinas · confirmação pendente',{exact:true}).click();
  await p.locator('#grade-curriculum-subjects').fill('Arte\nMatemática');await p.locator('#grade-curriculum input[type=checkbox]').check();
  await p.getByRole('button',{name:'Confirmar lista de disciplinas',exact:true}).click();
  await p.waitForFunction(n=>EduApp.getState().gradeCurricula?.[0]?.disciplines.length===n,2);
  assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Sem Nota/);
  assert.match(await p.locator('#view').innerText(),/Matemática/);
  assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);
  await p.getByText('Lista completa de disciplinas · conferir',{exact:true}).click();
  await p.locator('#grade-curriculum-subjects').fill('Arte');await p.locator('#grade-curriculum input[type=checkbox]').check();
  p.once('dialog',dialog=>{assert.match(dialog.message(),/Matemática/);assert.match(dialog.message(),/0 registro/);return dialog.accept();});
  await p.getByRole('button',{name:'Confirmar lista de disciplinas',exact:true}).click();
  await p.waitForFunction(n=>EduApp.getState().gradeCurricula?.[0]?.disciplines.length===n,1);
  assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Aprofundamento · 8,0/);
  const invalid=await p.evaluate(()=>{const s=EduApp.getState();s.gradeCurricula[0].disciplines=['Arte','ARTE'];try{EduApp.validateDB(s);return false;}catch{return true;}});assert.equal(invalid,true);
  await p.reload();await p.locator('[data-action=cloud-local-only]').click();assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Aprofundamento · 8,0/);
  await p.locator('#reference-year').fill('2025');await p.locator('#reference-year').dispatchEvent('change');
  assert.equal(await p.evaluate(()=>EduApp.getState().gradeCurricula[0].year),2026);
  assert.deepEqual(errors,[]);await p.close();

  const cloud=await browser.newPage(),cloudErrors=[];cloud.on('pageerror',e=>cloudErrors.push(e.message));await cloud.route('https://**',r=>r.abort());
  await cloud.addInitScript(seed=>{
   const user={id:'mock',email:'cejardiminterlagos@nrecascavel.com'};let listener;
   window.reads=0;window.writes=[];window.releaseCloud=null;
   window.testLogin=()=>{sessionStorage.removeItem('signedOut');listener('SIGNED_IN',{user});};
   window.supabase={createClient:()=>({auth:{onAuthStateChange:fn=>{listener=fn;},getSession:async()=>({data:{session:sessionStorage.signedOut?null:{user}}}),signOut:async()=>{sessionStorage.signedOut='1';listener('SIGNED_OUT',null);return {}; }},
    from:table=>{const query={select:()=>query,eq:()=>query,order:()=>query,range:async()=>({data:[]}),single:async()=>({data:{revision:7}}),maybeSingle:async()=>{window.reads++;if(!sessionStorage.loaded){await new Promise(resolve=>window.releaseCloud=resolve);sessionStorage.loaded='1';}return {data:{revision:7,payload:{...seed,grades:[]},updated_at:'2026-11-17T12:00:00Z'}};}};return query;},
    rpc:(name,args)=>{window.writes.push(args);throw Error('Unexpected write');}
   })};
  },seed);
  await cloud.goto(pathToFileURL(app).href+'#seliga');await cloud.waitForFunction(()=>window.releaseCloud);
  await cloud.evaluate(()=>window.dispatchEvent(new Event('online')));
  assert.equal(await cloud.evaluate(()=>window.reads),1);assert.deepEqual(await cloud.evaluate(()=>window.writes),[]);
  await cloud.evaluate(()=>window.releaseCloud());await cloud.locator('#cloud-gate').waitFor({state:'hidden'});
  assert.equal(await cloud.evaluate(()=>EduApp.getState().students.length),1);
  await cloud.locator('[data-action=cloud-signout]').click();await cloud.locator('#cloud-gate').waitFor({state:'visible'});
  assert.equal(await cloud.locator('[data-action=cloud-local-only]').isVisible(),false);assert.equal(await cloud.locator('#view').innerText(),'');
  assert.equal(await cloud.evaluate(()=>EduApp.getState().students.length),1);
  await cloud.reload();assert.equal(await cloud.locator('[data-action=cloud-local-only]').isVisible(),false);
  await cloud.evaluate(()=>window.testLogin());await cloud.locator('#cloud-gate').waitFor({state:'hidden'});
  assert.equal(await cloud.evaluate(()=>EduApp.getState().students.length),1);assert.deepEqual(await cloud.evaluate(()=>window.writes),[]);
  assert.deepEqual(cloudErrors,[]);
  console.log('PASS: curriculum confirmation/missing subject/persistence/year isolation; initial-sync race; logout/reload/relogin without data loss or cloud writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
