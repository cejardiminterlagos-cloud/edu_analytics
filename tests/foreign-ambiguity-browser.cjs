const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8');
 const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=[['001','Ana'],['002','Ana'],['003','Carla']].map(([registration,name])=>({id:registration,registration,name,group:'8º Ano A',series:'8EF',status:'MATRICULADO',rosterStudent:true,documents:{},sources:{},history:[]}));
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await browser.newPage();await p.route('https://**',r=>r.abort());
  await p.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
  await p.goto(pathToFileURL(app).href+'#importar');if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action=cloud-local-only]').click();
  await p.getByText('Importar relação de estudantes estrangeiros',{exact:true}).click();
  const csv='Escola;Teste\nPaís de origem;Nome do Estudante;CGM\n;Ana;001\nParaguai;Ana;\nUruguai;Carla;003';
  await p.locator('#foreign-import input').setInputFiles({name:'paises.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await p.locator('#foreign-import button').click();await p.locator('[data-action=foreign-apply]').waitFor();
  assert.match(await p.locator('#foreign-preview').textContent(),/Vínculo não confirmado/);
  await p.locator('[data-action=foreign-apply]').click();await p.waitForFunction(()=>EduApp.getState().students[2].foreignOrigin==='UY');
  const students=await p.evaluate(()=>EduApp.getState().students);
  assert.equal(students[0].foreignOrigin,undefined);assert.equal(students[1].foreignOrigin,undefined);
  console.log('PASS: reordered foreign headers/preamble, homonyms cannot borrow CGM from another line, valid country applied.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
