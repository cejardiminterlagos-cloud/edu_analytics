const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=[{id:'s1',registration:'001',name:'Estudante de demonstração',group:'6º Ano A',series:'6EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}];
 const subjects=['Arte','Ciências','Educação Física','Ensino Religioso','Geografia','História','Língua Portuguesa','Língua Inglesa','Matemática','Leitura','Recuperação de Matemática','Língua Espanhola','Projeto de Vida','Tecnologia','Redação'];
 seed.grades=subjects.map(discipline=>({year:2026,registration:'002',name:'Colega',group:'6º Ano A',discipline,notes:[7,8,null]}));
 const b=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const p=await b.newPage({viewport:{width:1440,height:1080}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
 await p.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/')+'#alunos');if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action="cloud-local-only"]').click();await p.locator('.student-name').first().click();await p.getByRole('button',{name:'Desempenho · Se Liga!',exact:true}).click();await p.locator('#manual-grade-editor summary').click();
 assert.equal(await p.locator('[data-manual-discipline]').count(),15);assert.deepEqual(await p.locator('.manual-grade-table thead th').allTextContents(),['Disciplina','1º trimestre','2º trimestre','3º trimestre','Média','Conceito']);
 const row=d=>p.locator('[data-manual-discipline]').filter({has:p.getByRole('rowheader',{name:d,exact:true})});
 await row('Arte').locator('[data-manual-note="0"]').fill('6,5');await row('Arte').locator('[data-manual-note="1"]').fill('7,5');assert.equal(await row('Arte').locator('[data-manual-mean]').innerText(),'7,00');assert.equal(await row('Arte').locator('[data-manual-concept]').innerText(),'Adequado');
 await row('Matemática').locator('[data-manual-note="0"]').fill('11');await p.locator('#manual-grade-reason').fill('Conferência de duas disciplinas');await p.getByRole('button',{name:'Salvar notas manuais'}).click();assert.equal(await p.evaluate(()=>EduApp.getState().grades.length),15);
 await row('Matemática').locator('[data-manual-note="0"]').fill('9');await row('Matemática').locator('[data-manual-note="1"]').fill('9');assert.equal(await row('Matemática').locator('[data-manual-concept]').innerText(),'Avançado');await p.getByRole('button',{name:'Salvar notas manuais'}).click();await p.waitForFunction(()=>EduApp.getState().grades.length===17);
 const state=await p.evaluate(()=>EduApp.getState());assert.equal(state.students[0].history.length,1);assert.deepEqual(state.grades.filter(r=>r.registration==='002'),seed.grades);assert.deepEqual(state.grades.filter(r=>r.registration==='001').map(r=>r.notes),[[6.5,7.5,null],[9,9,null]]);
 await p.locator('#manual-grade-editor summary').click();await p.locator('#manual-grade-editor').evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:path.resolve(__dirname,'../../tmp/seliga/table-notes.png')});
 await p.setViewportSize({width:390,height:844});assert(await p.locator('.manual-grade-table').evaluate(el=>el.parentElement.scrollWidth>el.parentElement.clientWidth));assert.deepEqual(errors,[]);console.log('PASS: 15 classroom disciplines, live calculations, atomic multi-row save, untouched rows, audit and mobile table scrolling.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});

