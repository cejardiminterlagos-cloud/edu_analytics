const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=[{id:'s1',registration:'001',name:'Ana Teste',group:'8º Ano A',series:'8EF',status:'MATRICULADO',rosterStudent:true,documents:{},history:[],sources:{}}];
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await browser.newPage();await p.route('https://**',r=>r.abort());const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
  await p.goto(pathToFileURL(app).href+'#seliga');if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action=cloud-local-only]').click();
  await p.locator('details.panel').evaluate(e=>e.open=true);
  await p.locator('#grades-file').setInputFiles({name:'notas.csv',mimeType:'text/csv',buffer:Buffer.from('Escola;Teste\nT3;Disciplina;CGM;T1;T2\n8,0;Arte;001;0,0;7,0')});
  await p.locator('#grades-upload button[type=submit]').click();await p.locator('#grades-map').waitFor();
  await p.locator('#grades-map button[type=submit]').click();await p.locator('[data-action=grades-apply]').click();
  await p.waitForFunction(()=>EduApp.getState().grades?.length===1);
  assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades[0].notes),[0,7,8]);
  await p.getByRole('link',{name:'Calendário',exact:true}).click();
  await p.locator('#calendar-year').fill('2026');
  await p.locator('#calendar-file').setInputFiles({name:'calendario.csv',mimeType:'text/csv',buffer:Buffer.from('Escola;Teste\ndescricao;tipo;inicio;fim\nNatal;feriado;2026-12-25;2026-12-25')});
  await p.locator('#calendar-import button').first().click();await p.locator('#calendar-save').waitFor();
  assert.equal(await p.locator('[data-event=start]').first().inputValue(),'2026-12-25');
  await p.getByRole('link',{name:'Se Liga!',exact:true}).click();await p.locator('details.panel').evaluate(e=>e.open=true);
  const otherYear=',,,,Arte,,,,,\nnº,NOME DO ESTUDANTE,CGM,Ano,T1,T2,T3,Média,F,Grupo\n1,Ana Teste,001,2025,8,8,8,,,';
  await p.locator('#grades-file').setInputFiles({name:'ano-anterior.csv',mimeType:'text/csv',buffer:Buffer.from(otherYear)});
  await p.locator('#grades-upload button[type=submit]').click();
  await p.getByText('O arquivo declara ano 2025. Selecione o ano correspondente antes de importar.',{exact:true}).waitFor();
  assert.equal(await p.locator('[data-action=grades-apply]').count(),0);
  assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades[0].notes),[0,7,8]);
  assert.deepEqual(errors,[]);
  console.log('PASS: preambles/reordered flat-grade and calendar headers; roster identity and zero preserved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
