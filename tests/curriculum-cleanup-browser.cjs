const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.referenceYear=2026;seed.students=[['1','Ana','6º Ano A'],['2','Bia','7º Ano A'],['3','Caio','6º Ano A']].map(([registration,name,group])=>({id:registration,registration,name,group,status:registration==='3'?'TRANSFERIDO':'MATRICULADO',rosterStudent:true,documents:{},sources:{},history:[]}));
 const r=(registration,discipline,notes,year=2026,group='6º Ano A',manual)=>({registration,name:seed.students.find(s=>s.registration===registration).name,discipline,notes,year,group,...(manual?{manual}: {})});
 seed.grades=[r('1','Arte',[8,8,8]),r('1','Legado',[5,5,5]),r('1','Protegida',[7,7,7],2026,'6º Ano A',[true,false,false]),r('3','Legado',[6,6,6]),r('2','Legado',[9,9,9],2026,'7º Ano A'),r('1','Legado',[4,4,4],2025)];
 seed.gradeCurricula=[{year:2026,group:'6º Ano A',disciplines:['Arte','Legado','Protegida']},{year:2026,group:'7º Ano A',disciplines:['Legado']},{year:2025,group:'6º Ano A',disciplines:['Legado']}];
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>{if(!sessionStorage.seeded){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));sessionStorage.seeded='1';}},seed);await p.goto(pathToFileURL(app).href+'#seliga');await p.locator('[data-action=cloud-local-only]').click();await p.locator('#grades-group').selectOption('6º Ano A');
 const fill=async text=>{await p.locator('#grade-curriculum').evaluate(e=>e.closest('details').open=true);await p.locator('#grade-curriculum-subjects').fill(text);await p.locator('#grade-curriculum input[type=checkbox]').check();};
 const submit=()=>p.locator('#grade-curriculum button[type=submit]').click();
 await fill('Arte\nProtegida');p.once('dialog',d=>d.dismiss());await submit();assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);
 assert.deepEqual(await p.evaluate(()=>EduApp.getState().gradeCurricula),seed.gradeCurricula);
 await fill('Arte\nProtegida');p.once('dialog',d=>{assert.match(d.message(),/Legado/);assert.match(d.message(),/2 registro/);return d.accept();});await submit();await p.waitForFunction(()=>EduApp.getState().grades.length===4);
 assert.deepEqual(await p.locator('#grades-discipline option').allTextContents(),['Todas','Arte','Protegida']);assert.equal(await p.locator('#grade-curriculum-subjects').inputValue(),'Arte\nProtegida');
 assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades.filter(r=>!(r.year===2026&&r.group==='6º Ano A'&&r.discipline==='Legado')));
 assert.equal(await p.evaluate(()=>EduApp.getState().students.find(s=>s.registration==='1').history.length),1);
 await fill('');await submit();await p.getByText(/correções manuais protegidas/).waitFor();assert.equal(await p.evaluate(()=>EduApp.getState().grades.length),4);
 await p.locator('#grades-group').selectOption('7º Ano A');await fill('');p.once('dialog',d=>d.accept());await submit();await p.waitForFunction(()=>EduApp.getState().grades.length===3);
 assert.deepEqual(await p.locator('#grades-discipline option').allTextContents(),['Todas']);assert.equal(await p.locator('#grade-curriculum-subjects').inputValue(),'');
 assert.equal(await p.evaluate(()=>EduApp.getState().gradeCurricula.some(c=>c.group==='7º Ano A'&&c.year===2026)),false);
 assert.equal(await p.evaluate(()=>EduApp.getState().grades.some(r=>r.year===2025&&r.discipline==='Legado')),true);
 await p.reload();if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action=cloud-local-only]').click();await p.waitForFunction(()=>EduApp.getState().grades.length===3);assert.equal(await p.evaluate(()=>EduApp.getState().grades.length),3);assert.deepEqual(errors,[]);
 console.log('PASS: cancel/confirm, inactive roster, protected manual notes, clearing all, other class/year, history and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
