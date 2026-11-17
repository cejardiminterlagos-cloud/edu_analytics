const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8');
 const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 global.window={};vm.runInThisContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);
 const file=process.argv[2];
 const rows=window.Edu.parseCSV(fs.readFileSync(file,'utf8'));
 const l=(registration,name)=>({id:registration,registration,name,group:'9º Ano A',series:'9EF',status:'MATRICULADO',rosterStudent:true,rosterYear:'2026',documents:{},sources:{},history:[]});
 const roster=new Map(),header=rows[0].map(window.Edu.normalize);
 const cgm=header.indexOf('CGM'),name=header.indexOf('NOME DO ESTUDANTE');
 for(const [index,row] of rows.slice(1).entries()){
  const id=cgm<0?String(index+1):row[cgm];
  if(/^\d+$/.test(id)&&row[name]&&!roster.has(id))roster.set(id,l(id,row[name]));
 }
 const ambiguous=[...roster.values()][0];
 const homonym=l('9999999901',ambiguous.name);
 const synthetic=l('0000000000','Pessoa teste de país');
 seed.students=[...roster.values(),homonym,synthetic];
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await browser.newPage();p.setDefaultTimeout(8000);await p.route('https://**',r=>r.abort());
  await p.addInitScript(state=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(state));},seed);
  await p.goto(pathToFileURL(app).href+'#importar');
  if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action=cloud-local-only]').click();
  await p.getByText('Importar relação de estudantes estrangeiros',{exact:true}).click();
  await p.locator('#foreign-import input').setInputFiles(file);
  await p.locator('#foreign-import button').click();
  await p.locator('[data-action=foreign-apply]').click();
  await p.waitForFunction(()=>EduApp.getState().students.some(s=>s.foreignOrigin),null,{timeout:8000}).catch(async e=>{throw Error(await p.locator('#notice').textContent(),{cause:e});});
  const matched=await p.evaluate(()=>EduApp.getState().students.filter(s=>s.foreignOrigin));
  assert.ok(matched.length>0);
  if(cgm<0)assert.ok(matched.every(s=>s.name!==ambiguous.name));
  assert.ok(matched.every(s=>s.history.length===1));
  await p.getByRole('link',{name:'Cruzamento de alunos',exact:true}).click();
  await p.locator('details').filter({has:p.locator('#filter-foreign')}).evaluateAll(items=>items.forEach(item=>item.open=true));
  await p.locator('#filter-foreign').selectOption('foreign');
  await p.getByText('Estrangeiro · Venezuela',{exact:true}).first().waitFor();
  await p.locator('#filter-foreign').selectOption('');
  await p.locator('#filter-search').fill(synthetic.name);
  await p.getByRole('button',{name:synthetic.name,exact:true}).click();
  await p.getByRole('button',{name:'Apoio e trabalho',exact:true}).click();
  assert.equal(await p.locator('#origin-field').isVisible(),false);
  await p.locator('#foreign-check').check();
  await p.locator('#origin-field select').selectOption('PY');
  await p.locator('#foreign-form button').click();
  await p.waitForFunction(id=>EduApp.getState().students.find(s=>s.id===id)?.foreignOrigin==='PY',synthetic.id,{timeout:8000}).catch(async e=>{throw Error(await p.locator('#notice').textContent(),{cause:e});});
  console.log('PASS: real CSV in isolated roster, '+matched.length+' country assignments, audit, filter and manual selection.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});



