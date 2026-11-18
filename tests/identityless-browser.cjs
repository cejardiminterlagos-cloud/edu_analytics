const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const base={status:'Matriculado',rosterStudent:true,group:'7º Ano A',series:'7EF',documents:{},history:[],sources:{}};
 seed.students=[{...base,id:'known',registration:'001',name:'Ana Teste'},{...base,id:'empty',registration:'',name:''},{...base,id:'proven',registration:'',name:'',history:[{confirmedIdentity:{registration:'002',name:'Bia Teste'}}]}];
 seed.referenceYear=2026;seed.grades=[];
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
 await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(s));sessionStorage.seeded='1';}window.print=()=>{};},seed);
 await p.goto(pathToFileURL(app).href+'#alunos');await p.locator('[data-action=cloud-local-only]').click();await p.waitForFunction(()=>EduApp.getState().students.find(s=>s.id==='proven').registration==='002');
 assert.deepEqual(await p.locator('#student-results .student-name').allTextContents(),['Ana Teste','Bia Teste']);
 assert.equal(await p.evaluate(()=>EduApp.getState().students.length),3);
 await p.locator('#filter-status').selectOption('fora');await p.getByRole('button',{name:'Nome não informado',exact:true}).click();
 assert.match(await p.locator('#dossier-body').innerText(),/Cadastro sem identidade confirmada; fora dos indicadores/);
 assert.match(await p.locator('#dossier-body').innerText(),/Não calculado/);
 assert.doesNotMatch(await p.locator('#dossier-body').innerText(),/Nenhum alerta nos dados disponíveis/);
 assert.match(await p.locator('#dossier-body').innerText(),/Não avaliada · identidade não confirmada/);
 assert.deepEqual(errors,[]);
 console.log('PASS: residual records retained outside normal lists; confirmed identity recovered automatically; dossier explains missing identity and unknown score.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
