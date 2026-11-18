const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const image=process.env.RAPID_IMAGE;if(!image)throw Error('Set RAPID_IMAGE to a verified screenshot.');
 const expectedCGM=process.env.RAPID_EXPECTED_CGM;
 const expectedNotes=JSON.parse(process.env.RAPID_EXPECTED_NOTES||'null');
 if(!expectedCGM||!expectedNotes)throw Error('Set RAPID_EXPECTED_CGM and RAPID_EXPECTED_NOTES with a privately verified sample.');
 const app=path.resolve(__dirname,'../index.html');
 const seed=JSON.parse(fs.readFileSync(app,'utf8').match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage();
  await page.route('https://**',route=>route.abort());
  await page.addInitScript(seed=>localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed)),seed);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(app).href+'#seliga');
  if(await page.locator('#cloud-gate').isVisible())await page.locator('[data-action=cloud-local-only]').click();
  const images=[image,...(process.env.RAPID_IMAGE_RIGHT?[process.env.RAPID_IMAGE_RIGHT]:[])];
  await page.locator('#grades-file').setInputFiles(images);
  const responsePromise=page.waitForResponse(r=>r.url()==='http://127.0.0.1:8766/recognize'&&r.request().method()==='POST',{timeout:180000});
  await page.locator('#grades-upload button[type=submit]').click();
  const response=await responsePromise;assert.equal(response.status(),200);
  const field=page.locator('#grade-image-data');await field.waitFor({timeout:360000});
  const lines=(await field.inputValue()).split('\n').map(line=>line.split('\t'));
  assert(lines.length>15);assert(lines.some(r=>r[0]===expectedCGM));
  const row=lines.find(r=>r[0]===expectedCGM);assert.deepEqual(row.slice(2,5),expectedNotes.arte);
  assert.equal(await page.locator('[data-action=grades-apply]').count(),0);
  assert.equal(await page.evaluate(()=>(EduApp.getState().grades||[]).length),0);
  if(images.length>1){
   assert.deepEqual(row.slice(2+8*3,2+9*3),expectedNotes.matematica);
   assert.equal(lines.filter(r=>r[0]===expectedCGM).length,1);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real browser → local HTTP → RapidOCR → review, actual screenshot; no grade write.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
