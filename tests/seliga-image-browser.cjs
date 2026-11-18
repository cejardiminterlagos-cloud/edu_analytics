const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');

(async()=>{
 const app=path.resolve(__dirname,'../index.html');
 const seed=JSON.parse(fs.readFileSync(app,'utf8').match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 seed.students=[{id:'s1',registration:'1234567890',name:'Ana Souza',group:'6º Ano A',series:'6EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}];
 seed.grades=[{year:seed.referenceYear,registration:'1234567890',name:'Ana Souza',group:'6º Ano A',discipline:'Arte',notes:[7,7,7],manual:[true,false,false]}];
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage();
  await page.route('https://**',r=>r.abort());
  let requests=0;
  const subjects=['Arte','Ciências','Educação Física','Geografia','História','Leitura Rec Aprend','Língua Inglesa','Língua Portuguesa','Matemática','Rec Aprend'];
  await page.route('http://127.0.0.1:8766/recognize',async route=>{
   requests++;
   assert.equal(route.request().headers()['x-eduanalytics-ocr'],'1');
   assert.equal(route.request().headers()['content-type'],'application/octet-stream');
   const notes=Array(30).fill('?');notes[0]=requests===1?'8,0':'9,0';notes[1]='0,0';
   await route.fulfill({json:{engine:'RapidOCR',version:1,subjects,imageRows:[['1234567890','ANA SOUZA',...notes]]}});
  });
  await page.addInitScript(seed=>{
   localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));
  },seed);
  await page.goto(pathToFileURL(app).href+'#seliga');
  if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action=cloud-local-only]').click();
  await page.locator('details.panel summary').click();
  const png=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1192;canvas.height=588;
   return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#grades-file').setInputFiles(['a','b'].map(name=>({name:name+'.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
  await page.locator('#grades-upload button[type=submit]').click();
  const field=page.locator('#grade-image-data');
  await field.waitFor();
  const values=(await field.inputValue()).split('\t');
  assert.equal(requests,2);
  assert.deepEqual(values.slice(0,5),['1234567890','ANA SOUZA','?','0,0','?']);
  assert.equal(await page.locator('#grades-mapping').getByText(/1 conflitos entre capturas/).count(),1);
  const review=page.locator('#grades-image-review');
  await review.getByRole('checkbox').check();
  await review.getByRole('button').click();
  assert.equal(await page.locator('[data-action=grades-apply]').count(),0);
  values[2]='8,0';
  await field.fill(values.map(v=>v==='?'?'':v).join('\t'));
  await review.getByRole('button').click();
  await page.locator('[data-action=grades-apply]').click();
  await page.waitForFunction(()=>EduApp.getState().grades.length===10);
  const saved=await page.evaluate(()=>EduApp.getState().grades.find(r=>r.discipline==='Arte'));
  assert.deepEqual(saved.notes,[7,0,7]);
  assert.deepEqual(saved.manual,[true,false,false]);
  await page.locator('#grades-group').selectOption('6º Ano A');
  const art=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Arte',exact:true})});
  assert.deepEqual(await art.getByRole('cell').allTextContents(),['1','0','0','0']);
  // A failed image must not leave a partial lot ready to apply.
  await page.route('http://127.0.0.1:8766/recognize',route=>route.fulfill({status:422,json:{error:'Cabeçalhos não reconhecidos.'}}));
  await page.locator('details.panel summary').click();
  await page.locator('#grades-file').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('#grades-upload button[type=submit]').click();
  await page.getByText('Cabeçalhos não reconhecidos.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-action=grades-apply]').count(),0);
  assert.equal(await page.locator('#grade-image-data').count(),0);
  assert.equal(await page.evaluate(()=>EduApp.getState().grades.length),10);
  console.log('PASS: RapidOCR batch HTTP, overlaps, conflicts, failed lots, protected grades and diagnosis.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
