const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {pathToFileURL}=require('url');
(async()=>{
 const files=process.argv.slice(2);if(files.length!==3)throw Error('Provide corresponding CSV, XLSX and consolidated PDF.');
 const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8'),context={window:{}};
 vm.runInNewContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);const E=context.window.Edu;
 const data=E.consolidatedGrades(E.parseCSV(fs.readFileSync(files[0],'utf8')));
 const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=data.data.map(row=>({id:String(row[1]),registration:String(row[1]),name:String(row[2]),group:'8º Ano C',series:'8EF',status:'MATRICULADO',rosterYear:String(seed.referenceYear),rosterStudent:true,documents:{},sources:{},history:[]}));
 const first=seed.students[0];
 seed.grades=[{year:seed.referenceYear,registration:first.registration,name:first.name,group:first.group,discipline:data.blocks[0].name,notes:[1,2,3],manual:[true,false,false]},
 {year:seed.referenceYear-1,registration:first.registration,name:first.name,group:'7º Ano C',discipline:'Histórico anterior',notes:[9,9,9]}];
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  for(const file of files){
   const page=await browser.newPage();await page.route('https://**',r=>r.abort());
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
   await page.goto(pathToFileURL(app).href+'#seliga');
   if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action=cloud-local-only]').click();
   await page.addScriptTag({path:process.env.XLSX_PATH||path.resolve(__dirname,'../../tmp/xlsx.full.min.js')});
   await page.addScriptTag({path:path.resolve(__dirname,'../../tmp/pdf.min.js')});
   await page.addScriptTag({path:path.resolve(__dirname,'../../tmp/pdf.worker.min.js')});
   await page.locator('details.panel').evaluate(e=>e.open=true);
   await page.locator('#grades-file').setInputFiles(file);await page.locator('#grades-upload button[type=submit]').click();
   await page.locator('#grades-consolidated').waitFor();
   assert.equal(await page.locator('[data-consolidated-subject]').count(),data.blocks.length);
   assert.equal(await page.locator('[data-consolidated-group]').count(),0);
   assert.equal(await page.locator('#grades-pdf-links').count(),0);
   await page.locator('#grades-consolidated button[type=submit]').click();
   await page.locator('[data-action=grades-apply]').click();
   await page.waitForFunction(n=>EduApp.getState().grades.length===n,data.data.length*data.blocks.length+1);
   const saved=await page.evaluate(()=>EduApp.getState().grades);
   assert.deepEqual(saved.find(r=>r.year===seed.referenceYear-1).notes,[9,9,9]);
   for(const row of data.data)for(const [i,block] of data.blocks.entries()){
    const subject=await page.evaluate(name=>({'ED. FÍSICA':'Educação Física','ED. DIGITAL':'Educação Digital'})[name]||name,block.name);
    const actual=saved.find(r=>r.year===seed.referenceYear&&r.registration===String(row[1])&&r.discipline===subject);
    const expected=[0,1,2].map(t=>E.importGradeNumber(row[block.col+t]));
    if(row[1]===first.registration&&i===0)expected[0]=1;
    assert.deepEqual(actual.notes,expected);
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: actual CSV/XLSX/9-page PDF, automatic sheet selection, roster CGM linkage, all term cells, protected notes and prior year.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
