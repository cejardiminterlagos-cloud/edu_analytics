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
  await page.addInitScript(seed=>{
   localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));
   const word=(x,text)=>['5',1,1,1,1,1,x,9,12,24,98,text].join('\t');
   window.Tesseract={createWorker:async()=>({
    setParameters:async()=>{},terminate:async()=>{},
    recognize:async canvas=>({data:{tsv:canvas.width===624?word(18,'ANA SOUZA - 1234567890 |'):word(30,'8,0')+'\n'+word(130,'0,0')}})
   })};
  },seed);
  await page.goto(pathToFileURL(app).href+'#seliga');
  if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action=cloud-local-only]').click();
  await page.locator('details.panel summary').click();
  const png=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1192;canvas.height=588;
   return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#grades-file').setInputFiles({name:'captura.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('#grades-upload button[type=submit]').click();
  const field=page.locator('#grade-image-data');
  await field.waitFor();
  const values=(await field.inputValue()).split('\t');
  assert.deepEqual(values.slice(0,5),['1234567890','ANA SOUZA','8,0','0,0','?']);
  const review=page.locator('#grades-image-review');
  await review.getByRole('checkbox').check();
  await review.getByRole('button').click();
  assert.equal(await page.locator('[data-action=grades-apply]').count(),0);
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
  console.log('PASS: image review, uncertain cells blocked, overwrite, protected grades and class diagnosis.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
