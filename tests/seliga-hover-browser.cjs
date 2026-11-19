const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.referenceYear=2026;seed.students=[{id:'1',registration:'1',name:'Estudante de teste',group:'8º Ano A',status:'MATRICULADO',rosterStudent:true,documents:{},history:[],sources:{}}];
 seed.gradeCurricula=[{year:2026,group:'8º Ano A',disciplines:['Arte','Ciências','História']}];seed.grades=[{year:2026,registration:'1',name:'Estudante de teste',group:'8º Ano A',discipline:'Arte',notes:[5,5.2,6]},{year:2026,registration:'1',name:'Estudante de teste',group:'8º Ano A',discipline:'Ciências',notes:[0,null,8]}];
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));window.print=()=>{};},seed);await p.goto(pathToFileURL(app).href+'#seliga');await p.locator('[data-action=cloud-local-only]').click();await p.locator('#grades-group').selectOption('8º Ano A');
 const cells=p.locator('#view .grade-matrix tbody tr').first().locator('td').all();
 const expected=['T1: 5,0 · T2: 5,2 · T3: 6,0','T1: 0,0 · T2: — · T3: 8,0','T1: — · T2: — · T3: —'];
 for(const [i,cell]of (await cells).slice(1).entries()){await cell.locator('b').hover();assert.equal(await cell.getAttribute('title'),expected[i]);await cell.locator('b').focus();assert.match(await cell.locator('b').getAttribute('aria-label'),new RegExp(expected[i]));}
 await p.locator('[data-action=grades-pdf]').click();assert.equal(await p.locator('#print-area [tabindex]').count(),0);assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);assert.deepEqual(errors,[]);console.log('PASS: compact term tooltip, decimal comma, zero, incomplete/unimported subjects, keyboard labels, print and unchanged grades.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
