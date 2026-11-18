const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
const app=path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(app,'utf8');
const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const vm=require('node:vm'),context={window:{}};
vm.runInNewContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);
const file=process.argv[2]||'C:/Users/Bruno/Downloads/8ºA.xlsx - Consolidado notas.csv';
const {data,blocks}=context.window.Edu.consolidatedGrades(context.window.Edu.parseCSV(fs.readFileSync(file,'utf8')));
const roster=data.map(([,registration,name])=>({id:registration,registration,name:name||'Nome Teste '+registration,group:'8º Ano A',status:'MATRICULADO',series:'8EF',rosterYear:String(seed.referenceYear),documents:{},history:[],sources:{},rosterStudent:true}));
const pending=roster.at(-1),[known]=roster;
seed.students=roster.slice(0,-1);
seed.grades=[{year:seed.referenceYear,registration:known.registration,name:known.name,group:known.group,discipline:'Disciplina antiga',notes:[9,9,9]}];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const prepare=async state=>{
  const page=await browser.newPage();await page.route('https://**',r=>r.abort());
  await page.addInitScript(db=>{if(!sessionStorage.seeded){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(db));sessionStorage.seeded='1';}},state);
  await page.goto(pathToFileURL(app).href+'#seliga');
  if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action=cloud-local-only]').click();
  await page.locator('details.panel').evaluate(e=>e.open=true);
  await page.locator('#grades-file').setInputFiles(file);
  await page.locator('#grades-upload button[type=submit]').click();
  await page.locator('#grades-consolidated').waitFor();
  return page;
 };
 const partial=await prepare(seed);
 assert.match(await partial.locator('#grades-consolidated').innerText(),new RegExp(pending.registration));
 assert.equal(await partial.locator('#consolidated-replace-subjects').isDisabled(),true);
 assert.equal(await partial.locator('[data-consolidated-group]').count(),0);
 await partial.locator('#grades-consolidated button').click();
 assert.match(await partial.locator('#grades-preview').innerText(),/1 estudante.+sem turma confirmada/);
 await partial.locator('[data-action=grades-apply]').click();
 const expected=(roster.length-1)*blocks.length+1;
 await partial.waitForFunction(n=>EduApp.getState().grades.length===n,expected);
 const saved=await partial.evaluate(()=>EduApp.getState().grades);
 assert.ok(saved.every(row=>row.registration!==pending.registration));
 assert.ok(saved.some(row=>row.discipline==='Disciplina antiga'));
 const complete=await prepare({...seed,students:roster,grades:saved});
 await complete.locator('#consolidated-replace-subjects').check();
 await complete.locator('#grades-consolidated button').click();
 assert.match(await complete.locator('#grades-preview').innerText(),/1 registro\(s\) a remover/);
 await complete.locator('[data-action=grades-apply]').click();
 await complete.waitForFunction(n=>EduApp.getState().grades.length===n,roster.length*blocks.length);
 const updated=await complete.evaluate(()=>EduApp.getState().grades);
 const curricula=await complete.evaluate(()=>EduApp.getState().gradeCurricula);assert.equal(curricula.length,1);assert.equal(curricula[0].disciplines.length,blocks.length);assert.equal(curricula[0].year,seed.referenceYear);
 assert.ok(updated.some(row=>row.registration===pending.registration));
 assert.ok(updated.every(row=>row.discipline!=='Disciplina antiga'));
 for(const source of data)for(const [index,block] of blocks.entries()){
  const record=updated.find(r=>r.registration===String(source[1]).trim()&&r.discipline===curricula[0].disciplines[index]);
  assert.ok(record);assert.equal(record.name,String(source[2]||roster.find(s=>s.registration===record.registration).name).trim());
  const expectedNotes=source.slice(block.col,block.col+3).map(value=>/^\s*[-\u2013\u2014]*\s*$/.test(String(value??''))?null:Number(String(value).trim().replace(',','.')));
  assert.deepEqual(record.notes,Array.from(expectedNotes));
 }
 console.log('PASS: real CSV, unresolved CGM skipped, cleanup blocked until roster confirmed, reimport and cleanup.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
