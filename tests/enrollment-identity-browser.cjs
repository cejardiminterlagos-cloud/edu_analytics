const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const base={status:'Matriculado',rosterStudent:true,group:'7º Ano A',series:'7EF',documents:{},history:[],sources:{}};
 seed.students=[{...base,id:'known',registration:'001',name:'Ana Teste'},{...base,id:'blank-name',registration:'002',name:''},{...base,id:'transferred',registration:'003',name:'Caio Teste',status:'Transferido'}];
 seed.enrollment={referenceYear:2026,records:[{registration:'001',name:'Ana Teste'},{registration:'002',name:'Bia Teste'},{registration:'003',name:'Caio Teste'}],source:'confirmacoes.xls'};
 seed.referenceYear=2026;seed.grades=[];
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(s=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(s)),seed);
 await p.goto(pathToFileURL(app).href+'#painel');await p.locator('[data-action=cloud-local-only]').click();await p.waitForFunction(()=>EduApp.getState().students.find(s=>s.id==='blank-name').name==='Bia Teste');
 assert.equal(await p.locator('.enrollment-panel [data-action=enrollment-filter][data-value=confirmed] strong').textContent(),'2');
 const outside=p.locator('.enrollment-panel details').filter({hasText:'Confirmações com cadastro fora da lista ativa'});
 assert.match(await outside.textContent(),/Caio Teste/);assert.match(await outside.textContent(),/Transferido/);
 assert.doesNotMatch(await outside.textContent(),/Bia Teste|Geral: Sem Nota|Lista de disciplinas/);
 await outside.locator('summary').click();await outside.getByRole('button',{name:'Caio Teste',exact:true}).click();assert.equal(await p.locator('#dossier').isVisible(),true);
 assert.equal(await p.evaluate(()=>EduApp.getState().students.length),3);assert.deepEqual(errors,[]);
 console.log('PASS: enrollment names recover by exact CGM before indicator totals; genuine transfers remain outside with accurate reason and clean clickable labels.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
