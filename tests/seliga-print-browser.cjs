const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const source=path.resolve(process.env.PRINT_HTML||path.join(__dirname,'../index.html')),html=fs.readFileSync(source,'utf8'),base=JSON.parse(html.match(/<script id="initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const b=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const [name,count,groups,subjects] of [['small',8,2,15],['large',45,1,15],['individual',1,1,15],['roster',40,1,0]]){
  const seed=structuredClone(base);seed.students=Array.from({length:count},(_,i)=>({id:'s'+i,registration:String(10000000+i),name:'Estudante Demonstração '+String(i+1).padStart(2,'0'),group:'6º Ano '+String.fromCharCode(65+i%groups),series:'6EF',status:'MATRICULADO',documents:{},history:[],sources:{},rosterStudent:true}));seed.grades=seed.students.flatMap(s=>Array.from({length:subjects},(_,i)=>({year:2026,registration:s.registration,name:s.name,group:s.group,discipline:'Disciplina '+String(i+1).padStart(2,'0'),notes:[6+i%4,7,null]})));
  const context=await b.newContext(),p=await context.newPage();await p.route('https://**',r=>r.abort());await p.addInitScript(seed=>{localStorage.setItem('eduanalytics_db_v1',JSON.stringify(seed));window.print=()=>{};},seed);await p.goto('file:///'+source.replaceAll('\\','/')+(name==='individual'||name==='roster'?'#alunos':'#seliga'));if(await p.locator('#cloud-gate').isVisible())await p.locator('[data-action="cloud-local-only"]').click();
  if(name==='individual'){await p.locator('.student-name').first().click();await p.getByRole('button',{name:'Desempenho · Se Liga!',exact:true}).click();await p.getByRole('button',{name:'Exportar relatório individual'}).click();}
  else await p.locator(name==='roster'?'[data-action="export-pdf"]':'[data-action="grades-pdf"]').click();
  await p.locator('#print-area table').first().waitFor({state:'attached'});const text=await p.locator('#print-area').textContent();assert(text.includes('Estudante Demonstração 01'));assert(text.includes('Estudante Demonstração '+String(count).padStart(2,'0')));if(subjects)assert(text.includes('Disciplina 15'));
  await p.emulateMedia({media:'print'});await p.pdf({path:path.resolve(__dirname,'../../tmp/seliga/'+(process.env.PRINT_PREFIX||'compact')+'-'+name+'.pdf'),preferCSSPageSize:true,printBackground:true});await context.close();
 }console.log('PASS: printed 2 small classes, 45-student matrix, 15-subject individual and 40-student roster.');}finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});

