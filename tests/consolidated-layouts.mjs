import './seliga.mjs';
import assert from 'node:assert/strict';
const E=window.Edu;
const rows=[['','','','Arte','','','','',''],['nº','NOME DO ESTUDANTE','CGM','T1','T2','T3','Média','F','Grupo'],['1','Ana','123','0,0','6,0','','','','']];
const before=structuredClone(rows);
const result=E.consolidatedGrades(rows);
assert.deepEqual(result.blocks,[{col:3,name:'Arte'}]);
assert.deepEqual(result.data,[['1','123','Ana','0,0','6,0','','','','']]);
assert.deepEqual(rows,before);
const broken=structuredClone(rows);broken[1][4]='T3';assert.throws(()=>E.consolidatedGrades(broken),/trimestral/);
const word=(text,x,y=-100,width=10)=>({text,x,y,width});
const common=[word('nº',10),word('NOME DO ESTUDANTE',50,-100,100),word('ARTE',400,-85,30),word('1',10,-130),word('Ana',50,-130,25)];
const pages=[
 [...common,word('CGM',200),word('T1',300),word('T2',360),word('1234567890',200,-130,70),word('0,0',310,-130),word('6,5',370,-130)],
 [...common,word('T3',300),word('Média',360),word('F (Falta)',420),word('Grupo',480),word('7,0',310,-130)]
];
assert.equal(typeof E.parseConsolidatedGradePDF,'function');
const pdf=E.consolidatedGrades(E.parseConsolidatedGradePDF(pages).rows);
assert.deepEqual(pdf.blocks,[{col:3,name:'ARTE'}]);
assert.deepEqual(pdf.data[0].slice(1,6),['1234567890','Ana','0,0','6,5','7,0']);
assert.equal(E.parseConsolidatedGradePDF([[word('Relatório por chamada',10)]]),null);
assert.throws(()=>E.parseConsolidatedGradePDF([pages[0]]),/incompleto/i);
const moved=structuredClone(pages);moved[1]=moved[1].map(w=>({...w,text:w.text==='Ana'?'Outra pessoa':w.text}));
assert.throws(()=>E.parseConsolidatedGradePDF(moved),/identidade/i);
console.log('PASS: discipline header above identity/terms, swapped name/CGM, source immutable and bad triplets blocked.');
