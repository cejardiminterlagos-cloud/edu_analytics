const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.referenceYear=2026;seed.students=['Ana','Bia','Caio','Duda','Eva','Inativo'].map((name,i)=>({id:String(i),registration:String(i+1),name,group:'9º Ano D',series:'9EF',status:i===5?'TRANSFERIDO':'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}));
 seed.gradeCurricula=[{year:2026,group:'9º Ano D',disciplines:['Arte','Matemática']}];
 const r=(i,discipline,notes)=>({year:2026,registration:String(i),name:seed.students[i-1].name,group:'9º Ano D',discipline,notes});
 seed.grades=[r(1,'Arte',[8,8,8]),r(1,'Matemática',[4,4,4]),r(2,'Arte',[6,6,6]),r(2,'Matemática',[10,10,10]),r(4,'Arte',[8,8,8]),r(5,'Arte',[8,null,8]),r(5,'Matemática',[8,8,8])];
 seed.students[0].name='';
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));window.print=()=>{};},seed);
 await p.goto(pathToFileURL(app).href+'#seliga');await p.locator('[data-action=cloud-local-only]').click();await p.waitForFunction(()=>EduApp.getState().students[0].name==='Ana');await p.locator('#grades-group').selectOption('9º Ano D');
 assert.equal(await p.locator('.grade-matrix tbody tr').count(),5);
 assert.match(await p.locator('.grade-matrix tbody tr').filter({has:p.getByRole('button',{name:'Eva',exact:true})}).innerText(),/Arte: falta T2/);
 await p.locator('#grades-level').selectOption('basic');assert.deepEqual(await p.locator('.grade-matrix .student-name').allTextContents(),['Ana']);
 await p.locator('#grades-discipline').selectOption('ARTE');assert.deepEqual(await p.locator('.grade-matrix .student-name').allTextContents(),['Bia']);
 await p.getByRole('button',{name:'Sem Nota: 3',exact:true}).click();assert.deepEqual(await p.locator('.grade-matrix .student-name').allTextContents(),['Caio','Duda','Eva']);
 assert.equal(await p.locator('#grades-discipline').inputValue(),'');
 await p.getByRole('button',{name:'Caio',exact:true}).click();assert.equal(await p.locator('#dossier').isVisible(),true);
 await p.getByRole('button',{name:'Fechar',exact:true}).click();await p.locator('#grades-search').fill('Caio');await p.locator('#grades-search').dispatchEvent('change');await p.waitForFunction(()=>document.querySelectorAll('.grade-matrix tbody tr').length===1);await p.locator('[data-action=grades-pdf]').click();assert.match(await p.locator('#print-area').textContent(),/Caio/);
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades),seed.grades);
 console.log('PASS: overall vs subject filter, three missing students including no records, inactive exclusion, counter links and dossier; no grade mutations.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
