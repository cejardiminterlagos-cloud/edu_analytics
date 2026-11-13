const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=[{id:'s1',registration:'001',name:'Estudante sem notas no PDF',group:'6º Ano A',series:'6EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}];seed.grades=[];
 const b=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const context=await b.newContext({viewport:{width:1365,height:1000},acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
  await p.addInitScript(seed=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));sessionStorage.setItem('seeded','1');}window.print=()=>{};},seed);
  await p.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/')+'#alunos');
  if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action="cloud-local-only"]').click();
  const open=async()=>{await p.locator('.student-name').first().click();await p.getByRole('button',{name:'Desempenho · Se Liga!',exact:true}).click();};
  const edit=async()=>{await p.locator('#manual-grade-editor summary').click();await p.locator('#manual-grade-discipline').fill('Matemática');await p.locator('#manual-grade-discipline').dispatchEvent('change');};
  const note=async(i,value)=>{await p.locator(`[data-manual-note="${i}"]`).fill(value);await p.locator(`[data-manual-note="${i}"]`).dispatchEvent('change');};
  const save=async()=>{await p.locator('#manual-grade-reason').fill('Conferência no registro escolar: estudante ausente do PDF.');await p.getByRole('button',{name:'Salvar notas manuais'}).click();};
  await open();await edit();await note(0,'11');await save();assert.match(await p.locator('#notice').innerText(),/faixa/);assert.equal(await p.evaluate(()=>EduApp.getState().grades.length),0);
  await note(0,'0');await note(1,'8');await save();await p.waitForFunction(()=>EduApp.getState().grades.length===1);
  let r=await p.evaluate(()=>EduApp.getState().grades[0]);assert.deepEqual(r.notes,[0,8,null]);assert.deepEqual(r.manual,[true,true,false]);assert.match(await p.locator('.individual-grades').innerText(),/4,0/);
  await edit();await note(0,'7,5');await note(1,'');await save();await p.waitForFunction(()=>EduApp.getState().grades[0].notes[0]===7.5);assert.equal(await p.evaluate(()=>EduApp.getState().students[0].history.length),2);
  await p.getByRole('button',{name:'Exportar relatório individual'}).click();assert.match(await p.locator('#print-area').innerText(),/7,5/);
  await p.getByRole('button',{name:'Fechar',exact:true}).click();await p.getByRole('link',{name:'Se Liga!',exact:true}).click();
  const importCSV=async()=>{if(!await p.locator('#grades-file').isVisible())await p.locator('#view details.panel summary').click();await p.locator('#grades-file').setInputFiles({name:'novas.csv',mimeType:'text/csv',buffer:Buffer.from('CGM;Disciplina;T1;T2;T3\n001;Matemática;1;10;9')});await p.getByRole('button',{name:'Ler e conferir colunas'}).click();await p.getByRole('button',{name:'Conferir importação',exact:true}).click();await p.getByRole('button',{name:'Aplicar notas conferidas'}).click();};
  await importCSV();await p.waitForFunction(()=>EduApp.getState().grades[0].notes[2]===9);assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades[0].notes),[7.5,null,9]);assert.match(await p.locator('.grade-matrix').innerText(),/8,25/);
  await p.getByRole('link',{name:'Cruzamento de alunos',exact:true}).click();await open();await edit();assert.equal(await p.locator('[data-manual-note="0"]').inputValue(),'7.5');await p.locator('[data-manual-lock="1"]').uncheck();await save();
  await p.getByRole('button',{name:'Fechar',exact:true}).click();await p.getByRole('link',{name:'Se Liga!',exact:true}).click();await importCSV();await p.waitForFunction(()=>EduApp.getState().grades[0].notes[1]===10);
  await p.reload();await p.waitForFunction(()=>window.EduApp?.getState().grades?.[0]?.notes[1]===10);if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action="cloud-local-only"]').click();
  assert.deepEqual(await p.evaluate(()=>EduApp.getState().grades[0].manual),[true,false,false]);
  await p.getByRole('link',{name:'Cruzamento de alunos',exact:true}).click();await open();await edit();await p.screenshot({path:path.resolve(__dirname,'../../tmp/seliga/manual-notes.png')});
  assert.deepEqual(errors,[]);console.log('PASS: missing student grades, validation, manual zero/blank, audit, protection/release, reimport, matrix, PDF and reload.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});

