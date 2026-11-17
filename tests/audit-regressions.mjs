import './seliga.mjs';
import assert from 'node:assert/strict';
const E=window.Edu;
assert.deepEqual(E.parseCSV('Título\nCGM,Nome,T1\n001,"Nome, Teste",8'),[['Título','',''],['CGM','Nome','T1'],['001','Nome, Teste','8']]);
assert.deepEqual(E.parseCSV('\uFEFFTítulo\r\nCGM;Nome;T1\r\n001;"Nome;\nTeste";6,3'),[['Título','',''],['CGM','Nome','T1'],['001','Nome;\nTeste','6,3']]);
assert.throws(()=>E.parseCSV('A;B\n1;2;3'));
assert.throws(()=>E.parseCSV('A,B\n1,"sem fim'));
const student={id:'a',registration:'001',name:'Teste',group:'8 A',series:'8EF',status:E.confirmedAbsence,rosterDate:'2026-11-10',rosterYear:'2026',documents:{},history:[],sources:{},schoolYears:{2026:{status:E.confirmedAbsence,group:'8 A',series:'8EF',rosterDate:'2026-11-10'}}};
for(const date of [undefined,'2026-11-09','2026-11-10','2026-11-11']){
 const incoming={registration:'001',name:'Teste',group:'8 B',series:'8EF',status:'MATRICULADO',rosterDate:date,_rosterYear:2026};
 const result=E.mergeStudentDatasets([student],[incoming],'Teste',true,'i',true).students[0];
 const expected=date==='2026-11-11'?'MATRICULADO':E.confirmedAbsence;
 assert.equal(result.status,expected);assert.equal(result.schoolYears[2026].status,expected);
 assert.equal(result.group,date==='2026-11-11'?'8 B':'8 A');
}
const historic=E.mergeStudentDatasets([student],[{registration:'001',name:'Teste',group:'7 A',series:'7EF',status:'MATRICULADO',rosterDate:'2025-11-11',_rosterYear:2025}],'Teste',true,'i',true).students[0];
assert.equal(historic.status,E.confirmedAbsence);assert.equal(historic.schoolYears[2025].group,'7 A');
console.log('PASS: CSV preambles/quotes/validation; confirmed absence, newer enrollment and separate school years.');
const grade={year:2026,registration:'001',name:'Teste',group:'8 A',discipline:'Educação Física',notes:[8,8,8],manual:[true,false,false]};
for(const discipline of ['ED. FÍSICA','EDUCACAO FIS','Educação Física - 601'])assert.throws(()=>E.mergeGrades([grade],[{...grade,discipline}]),/Possível disciplina duplicada/);
assert.equal(E.mergeGrades([grade],[{...grade,discipline:'Educação Digital'}]).records.length,2);
assert.equal(E.mergeGrades([grade],[{...grade,discipline:'ED. FÍSICA',year:2025}]).records.length,2);
assert.equal(E.mergeGrades([grade],[{...grade,notes:[0,7,7]}]).records[0].notes[0],8);
assert.throws(()=>E.mergeGrades([],[grade,{...grade,discipline:'ED. FÍSICA'}]),/Possível disciplina duplicada/);
console.log('PASS: ambiguous subject aliases stop before writing; distinct subjects/years and protected notes stay separate.');
