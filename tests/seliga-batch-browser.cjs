const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
(async()=>{const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');global.window={};vm.runInThisContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);
const reports=['3b','3c','3d'].map(name=>({name,report:window.Edu.parseGradePDF(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../tmp/seliga/'+name+'-words.json'),'utf8')))}));
const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);let id=0;
seed.students=reports.flatMap(({report})=>report.students.map(s=>({id:'t'+(++id),registration:String(id).padStart(8,'0'),name:s.name,group:'3º EM '+report.className,series:'3EM',shift:report.shift,status:'MATRICULADO',rosterStudent:true,documents:{},history:[],sources:{}})));
const b=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
 await p.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/')+'#importar');await p.locator('#batch-input').waitFor();if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action="cloud-local-only"]').click();
 await p.addScriptTag({path:path.resolve(__dirname,'../../tmp/pdf.min.js')});await p.addScriptTag({path:path.resolve(__dirname,'../../tmp/pdf.worker.min.js')});
 await p.locator('#batch-input').setInputFiles(['3b','3c','3d'].map(name=>(process.env.GRADE_PDF_DIR||'C:/Users/Bruno/Downloads')+'/'+name+'.pdf'));
 await p.getByRole('button',{name:'Conferir notas em sequência',exact:true}).waitFor();assert.equal(await p.locator('[data-batch-field="kind"]').count(),3);
 assert.deepEqual(await p.locator('[data-batch-field="kind"]').evaluateAll(els=>els.map(e=>e.value)),['grades','grades','grades']);
 assert.equal(await p.locator('[data-action="batch-preview"]').count(),0);
 await p.screenshot({path:path.resolve(__dirname,'../../tmp/seliga/batch-grades-fixed.png'),fullPage:true});
 await p.locator('#batch-input').setInputFiles({name:'cadastro.csv',mimeType:'text/csv',buffer:Buffer.from('CGM;Nome;Turma;Série;Situação\n99999999;Aluno Teste Lote;3º EM A;3EM;MATRICULADO')});
 await p.getByRole('button',{name:'Conferir lote',exact:true}).click();await p.getByRole('button',{name:'Aplicar lote',exact:true}).click();
 await p.waitForFunction(()=>EduApp.getState().students.length===108);
 assert.equal(await p.locator('[data-batch-field="kind"]').count(),3);
 await p.getByRole('button',{name:'Conferir notas em sequência',exact:true}).click();
 let count=0;
 for(const {name,report} of reports){
  await p.locator('#grades-pdf-links').waitFor();assert.match(await p.locator('#grades-mapping').innerText(),new RegExp(name+'\\.pdf'));
  assert.equal(await p.locator('[data-grade-link]').count(),report.students.length);
  for(let i=0;i<report.students.length;i++){const input=p.locator('[data-grade-link]').nth(i),expected=String(count/4+i+1).padStart(8,'0');if(!await input.inputValue()){await input.fill(expected);await input.dispatchEvent('change');}else assert.equal(await input.inputValue(),expected);}
  await p.getByRole('button',{name:'Conferir notas e vínculos',exact:true}).click();
  await p.getByRole('button',{name:'Aplicar notas conferidas',exact:true}).click();count+=report.students.length*4;
  await p.waitForFunction(n=>EduApp.getState().grades?.length===n,count);
 }
 assert.equal(count,428);await p.getByRole('link',{name:'Importar e cruzar',exact:true}).click();assert.equal(await p.locator('[data-action="batch-grades"]').count(),0);
 assert.equal(await p.evaluate(()=>EduApp.getState().students.length),108);assert.deepEqual(errors,[]);
 console.log('PASS: three real grade PDFs recognized in general batch, sequential CGM review, 428 records, no lost students or queued files.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
