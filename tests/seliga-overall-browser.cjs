const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
const app=path.resolve(__dirname,'../index.html'),html=fs.readFileSync(app,'utf8');
const seed=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
seed.students=[{id:'s1',registration:'001',name:'Ana Teste',group:'8º Ano A',series:'8EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}];
seed.grades=[{year:2026,registration:'001',name:'Ana Teste',group:'8º Ano A',discipline:'Arte',notes:[5,5,5]},{year:2026,registration:'001',name:'Ana Teste',group:'8º Ano A',discipline:'Matemática',notes:[8,8,8]},{year:2026,registration:'002',name:'Bia Teste',group:'8º Ano A',discipline:'Arte',notes:[9,9,9]}];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
await p.addInitScript(seed=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));window.print=()=>{};},seed);
await p.goto(pathToFileURL(app).href+'#seliga');if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action=cloud-local-only]').click();
assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Reforço · 6,5/);
assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Sem Nota/);
await p.locator('#grades-discipline').selectOption('ARTE');
assert.match(await p.locator('.grade-matrix').innerText(),/Geral: Reforço · 6,5/);
await p.getByRole('button',{name:'Ana Teste',exact:true}).click();
assert.match(await p.locator('#dossier-body').innerText(),/Geral: Reforço · 6,5/);
await p.getByRole('button',{name:'Fechar',exact:true}).click();
await p.getByRole('button',{name:'Bia Teste',exact:true}).click();
assert.match(await p.locator('#dossier-body').innerText(),/sem cadastro completo/);
await p.getByRole('button',{name:'Fechar',exact:true}).click();
await p.locator('#grades-group').selectOption('8º Ano A');
assert.match(await p.locator('#view').innerText(),/Conceito geral dos estudantes/);
await p.getByRole('link',{name:'Cruzamento de alunos',exact:true}).click();
assert.match(await p.locator('#view').innerText(),/Geral: Reforço · 6,5/);
await p.getByRole('button',{name:'Ana Teste',exact:true}).click();assert.equal(await p.locator('#dossier').isVisible(),true);
assert.deepEqual(errors,[]);console.log('PASS: general tags, filter independence, roster/grades-only dossiers, class dashboard and roster name clicks.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
