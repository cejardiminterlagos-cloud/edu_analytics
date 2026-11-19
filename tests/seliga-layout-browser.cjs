const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const subjects=['ARTE - 704','EDUCACAO FISICA - 601','ED DIG COMP PROG E IA - 6507','LEITURA REC APREND LINGUA PORTUGUESA - 6505',...Array.from({length:31},(_,i)=>'Componente curricular de teste '+i)];
 seed.referenceYear=2026;seed.students=Array.from({length:30},(_,i)=>({id:String(i),registration:String(i+1),name:'Nome de estudante para teste '+i,group:'8º Ano A',series:'8EF',status:'MATRICULADO',rosterStudent:true,documents:{},history:[],sources:{}}));
 seed.gradeCurricula=[{year:2026,group:'8º Ano A',disciplines:subjects}];seed.grades=seed.students.flatMap(s=>subjects.map(discipline=>({year:2026,registration:s.registration,name:s.name,group:s.group,discipline,notes:[8,8,8]})));
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));window.print=()=>{};},seed);await p.goto(pathToFileURL(app).href+'#seliga');await p.locator('[data-action=cloud-local-only]').click();
 assert.equal(await p.locator('#grade-school-overview tbody tr').count(),30);assert.equal(await p.locator('#view .grade-matrix').count(),0);
 await p.locator('#grade-school-overview .student-name').first().click();assert(await p.locator('#dossier').isVisible());await p.getByRole('button',{name:'Fechar',exact:true}).click();
 await p.locator('#grades-group').selectOption('8º Ano A');
 for(const width of [1440,1024,390]){
  await p.setViewportSize({width,height:1000});const wrap=p.locator('.grade-matrix-wrap');await wrap.scrollIntoViewIfNeeded();
  const metrics=await wrap.evaluate(w=>{const t=w.querySelector('table'),heads=[...t.querySelectorAll('thead th')],name=t.querySelector('tbody tr td'),x=name.getBoundingClientRect().x;w.scrollLeft=500;w.scrollTop=100;return {scroll:w.scrollWidth>w.clientWidth,widths:heads.slice(2).map(h=>h.getBoundingClientRect().width),height:heads[2].getBoundingClientRect().height,nameDelta:name.getBoundingClientRect().x-x,headTop:heads[2].getBoundingClientRect().top,wrapTop:w.getBoundingClientRect().top};});
  assert(metrics.scroll);assert(metrics.widths.every(w=>w>=120));assert(metrics.height<110);if(width>700)assert(Math.abs(metrics.nameDelta)<2);assert(Math.abs(metrics.headTop-metrics.wrapTop)<3);
  await wrap.evaluate(w=>{w.scrollLeft=0;w.scrollTop=0;});await p.screenshot({path:path.resolve(__dirname,'../../tmp/seliga-layout-'+width+'.png')});
 }
 assert.equal(await p.locator('.grade-subject-label').first().getAttribute('title'),subjects[0]);
 await p.setViewportSize({width:1440,height:1000});await p.locator('[data-action=grades-pdf]').click();assert.equal(await p.locator('#print-area .grade-print').count(),3);
 await p.locator('#grades-group').selectOption('');await p.locator('#grades-discipline').selectOption('ARTE - 704');assert.match(await p.locator('#grade-school-overview thead').innerText(),/Média da disciplina/);assert.equal(await p.locator('#view .grade-matrix').count(),0);
 assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);assert.deepEqual(errors,[]);console.log('PASS: school overview, dossier, 35 columns, desktop/tablet/mobile, sticky identity/header, horizontal scroll, print and unchanged grades.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
