const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.request().url().includes('xlsx.full.min.js')?r.fulfill({path:(process.env.XLSX_PATH||path.resolve(__dirname,'../../tmp/xlsx.full.min.js')),contentType:'application/javascript'}):r.abort());
 await page.addInitScript(()=>{window.print=()=>{window.printCalled=true;};});
 await page.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/')+'#seliga');
 await page.getByRole('heading',{name:'Se Liga!',exact:true}).waitFor();
 if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action="cloud-local-only"]').click();
 const names=['Língua Portuguesa','Matemática','Ciências','História','Geografia','Língua Inglesa','Arte','Educação Física','Ensino Religioso','Redação','Literatura','Educação Financeira','Pensamento Computacional','Projeto de Vida','Empreendedorismo'];
 const students=['Ana Clara Souza','Bruno Henrique Lima','Camila Oliveira Santos','Daniel Ferreira Costa','Eduarda Martins Silva','Felipe Almeida Rocha','Gabriela Pereira Alves','Henrique Ribeiro Dias','Isabela Gomes Melo','João Pedro Carvalho'];
 const values=[[9,9,9],[6,6,6],[7,7,7],[5.9,5.9,5.9],[8.9,8.9,8.9],['',6,8],['','',9],[0,6,6],['','',5],['','','']];
 const header='CGM;Nome do estudante;Turma;Disciplina;1º trimestre;2º trimestre;3º trimestre';
 const csv=[header,...students.flatMap((name,j)=>names.map((discipline,d)=>[String(j+1).padStart(6,'0'),name,'9º A',discipline,...values[j].map(v=>v===''?'':Math.max(0,Math.min(10,v+(d%3-1)*.2)).toFixed(1).replace('.',','))].join(';')))].join('\n');
 async function read(csv){
  const details=page.locator('details.panel');if(!(await details.getAttribute('open')!==null))await details.locator('summary').click();
  await page.locator('#grades-file').setInputFiles({name:'notas-teste.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByRole('button',{name:'Ler e conferir colunas',exact:true}).click();
  await page.getByRole('button',{name:'Conferir importação',exact:true}).click();
 }
 await read(csv);
 assert.match(await page.locator('#grades-preview').innerText(),/150 novos/);
 await page.getByRole('button',{name:'Aplicar notas conferidas'}).click();
 await page.waitForFunction(()=>EduApp.getState().grades?.length===150);
 assert.equal(await page.locator('#view .grade-matrix tbody tr').count(),10);
 assert.equal(await page.locator('#view .grade-matrix thead th').count(),17);
 await page.reload();await page.getByRole('heading',{name:'Se Liga!',exact:true}).waitFor();
 if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action="cloud-local-only"]').click();
 assert.equal(await page.evaluate(()=>EduApp.getState().grades.length),150);
 await page.locator('#grades-level').selectOption('below');assert(await page.locator('#view .grade-matrix tbody tr').count()<10);
 await page.getByRole('button',{name:'Limpar filtros'}).click();
 await page.locator('#grades-discipline').selectOption('MATEMATICA');
 assert.equal(await page.locator('#view .grade-matrix thead th').count(),3);
 await page.getByRole('button',{name:'Limpar filtros'}).click();
 const dlPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 const dl=await dlPromise,text=fs.readFileSync(await dl.path(),'utf8');assert(text.includes('Conceito'));assert(text.includes('Adequado'));assert(text.includes('000001'));
 await page.getByRole('button',{name:'Exportar PDF',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.printCalled),true);
 assert.equal(await page.locator('#print-area .grade-matrix thead th').count(),17);
 const artifacts=path.resolve(__dirname,'../../tmp/seliga');fs.mkdirSync(artifacts,{recursive:true});
 await page.evaluate(()=>{document.querySelector('#print-area h1').textContent+=' · SIMULAÇÃO';});
 await page.emulateMedia({media:'print'});
 await page.screenshot({path:path.join(artifacts,'print.png'),fullPage:true});
 await page.pdf({path:path.resolve(__dirname,'../../output/pdf/Se-Liga-conceitos-atualizados.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.equal(await page.locator('#grades-page-style').count(),0);
 await page.emulateMedia({media:'screen'});
 await read(header+'\n000001;Ana Clara Souza;9º A;Matemática;;0;10');
 await page.getByRole('button',{name:'Aplicar notas conferidas'}).click();
 await page.waitForFunction(()=>EduApp.getState().grades.find(r=>r.registration==='000001'&&r.discipline==='Matemática').notes[1]===0);
 assert.deepEqual(await page.evaluate(()=>EduApp.getState().grades.find(r=>r.registration==='000001'&&r.discipline==='Matemática').notes),[9,0,10]);
 await read(header+'\n000001;Ana Clara Souza;9º A;Matemática;11;;');
 assert.equal(await page.locator('[data-action="grades-apply"]').count(),0);
 assert.match(await page.locator('#notice').innerText(),/0 a 10/);
 await page.locator('#reference-year').fill('2025');await page.locator('#reference-year').dispatchEvent('change');
 await page.waitForFunction(()=>EduApp.getState().referenceYear===2025);
 assert.match(await page.locator('#view .grade-matrix').innerText(),/Nenhum estudante/);
 assert.equal(await page.evaluate(()=>EduApp.getState().grades.length),150);
 await page.locator('#reference-year').fill('2026');await page.locator('#reference-year').dispatchEvent('change');
 await page.waitForFunction(()=>EduApp.getState().referenceYear===2026);
 await page.screenshot({path:path.join(artifacts,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

 // Exercise the existing Excel reader with two sheets and persist the selected sheet.
 const XLSX=require((process.env.XLSX_PATH||path.resolve(__dirname,'../../tmp/xlsx.full.min.js')));
 await page.addScriptTag({path:process.env.XLSX_PATH||path.resolve(__dirname,'../../tmp/xlsx.full.min.js')});
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Informações'],['Selecione Notas']]),'Leia-me');
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([header.split(';'),['000001','Ana Clara Souza','9º A','Matemática',6,7,8]]),'Notas');
 const details=page.locator('details.panel');if(await details.getAttribute('open')===null)await details.locator('summary').click();
 await page.locator('#grades-file').setInputFiles({name:'notas.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}))});
 await page.getByRole('button',{name:'Ler e conferir colunas',exact:true}).click();
 await page.locator('#grades-sheet').waitFor({timeout:22000}).catch(async e=>{throw Error('Excel: '+await page.locator('#notice').innerText());});
 await page.locator('#grades-sheet').selectOption('1');
 await page.getByRole('button',{name:'Conferir importação',exact:true}).click();
 await page.getByRole('button',{name:'Aplicar notas conferidas'}).click();
 await page.waitForFunction(()=>EduApp.getState().grades.find(r=>r.registration==='000001'&&r.discipline==='Matemática').notes[0]===6);
 assert.equal(await page.evaluate(()=>EduApp.validateDB(EduApp.getState()).grades.length),150);
 assert.equal(await page.evaluate(()=>{const db=EduApp.getState();db.grades[0].notes=[11,null,null];try{EduApp.validateDB(db);return false;}catch{return true;}}),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: CSV/XLSX import/preview and backup validation, persistence, filters, CSV/PDF exports, correction, validation, years and mobile overflow.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});



