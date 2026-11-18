const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.referenceYear=2026;
 seed.students=[{id:'a',registration:'001',name:'Nome Teste',group:'9º Ano A',series:'9EF',status:'Matriculado',rosterStudent:true,documents:{},sources:{},history:[{confirmedIdentity:{registration:'001',name:'Nome Teste'},confirmedFields:{birth:'2012-07-13',phone:'(45) 99999-0000'},changes:[]}]}];
 seed.grades=[{registration:'001',name:'Nome Teste',year:2026,group:'9º Ano A',discipline:'Arte',notes:[0,7,8],manual:[true,false,false]}];
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
 await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(s));sessionStorage.seeded='1';}},seed);
 await p.goto(pathToFileURL(app).href+'#alunos');await p.locator('[data-action=cloud-local-only]').click();await p.waitForFunction(()=>EduApp.getState().students[0].phone==='(45) 99999-0000');
 await p.getByRole('button',{name:'Nome Teste',exact:true}).click();assert.match(await p.locator('#dossier-body').innerText(),/99999-0000/);assert.match(await p.locator('#dossier-body').innerText(),/14 anos em 2026/);
 assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);
 await p.reload();await p.locator('[data-action=cloud-local-only]').click();assert.equal(await p.evaluate(()=>EduApp.getState().students[0].history.length),2);
 assert.deepEqual(errors,[]);console.log('PASS: recovery without new screens, contact and age in dossier, persistence, idempotence and manual grades preserved.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
