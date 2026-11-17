import './seliga.mjs';
const E=window.Edu;
const {default:assert}=await import('node:assert/strict');
const rows=[['Título'],['Nº','CGM','NOME DO ESTUDANTE','ARTE','','','','',''],['','','','T1','T2','T3','Média','F','Grupo'],['1','123','Ana','0,0','—','7,0','','','']];
assert.equal(E.consolidatedGrades(rows).blocks.length,1);
for(const header of ['ESTUDANTE','NOME DO ALUNO']){
 const variant=structuredClone(rows);variant[1][2]=header;
 assert.deepEqual(E.consolidatedGrades(variant),E.consolidatedGrades(rows));
}
for(const header of ['NOME DO ESTUDANTE','ESTUDANTE','NOME DO ALUNO']){
 const swapped=rows.map(r=>[r[0],r[2],r[1],...r.slice(3)]);swapped[1][1]=header;
 const before=structuredClone(swapped);
 assert.deepEqual(E.consolidatedGrades(swapped),E.consolidatedGrades(rows));
 assert.deepEqual(swapped,before);
 const invalid=structuredClone(swapped);invalid[3][2]='CGM inválido';assert.throws(()=>E.consolidatedGrades(invalid),/CGM/);
}
assert.equal(E.consolidatedGrades([['CGM','Disciplina']]),null);
const bad=structuredClone(rows);bad[3][3]='11';assert.throws(()=>E.consolidatedGrades(bad));
const short=structuredClone(rows);short[3].pop();assert.throws(()=>E.consolidatedGrades(short));
const a={year:2026,registration:'123',name:'Ana',group:'8 A',discipline:'Arte',notes:[9,8,7],manual:[true,false,false]};
assert.deepEqual(E.mergeGrades([a],[{...a,notes:[0,null,6]}],true).records[0].notes,[9,null,6]);
assert.deepEqual(E.mergeGrades([a],[{...a,notes:[0,null,6]}]).records[0].notes,[9,8,6]);
console.log('PASS: consolidated detection, invalid values/rows, explicit missing replacement and legacy preservation.');

const oldSubject={...a,discipline:'ED DIG COMP',manual:[false,false,false]};
const protectedSubject={...oldSubject,discipline:'Redacao e Le',manual:[false,true,false]};
const absentStudent={...oldSubject,registration:'456',discipline:'Língua Espanhola'};
const unrelatedClass={...absentStudent,group:'8 B'};
const pastYear={...absentStudent,year:2025};
const existing=[oldSubject,protectedSubject,absentStudent,unrelatedClass,pastYear,a];
const {removed,protectedRows}=E.consolidatedGradeRemovals(existing,[{...a,group:'8 a'}]);
assert.deepEqual(removed,[oldSubject,absentStudent]);
assert.deepEqual(protectedRows,[protectedSubject]);
const target={...a,notes:[8,8,8],manual:[false,false,false]};
const before=[oldSubject,target];
assert.equal(E.overallGrade(before,a.registration,a.group,a.year).total,2);
const outdated=new Set(E.consolidatedGradeRemovals(before,[target]).removed.map(E.gradeKey));
const after=E.mergeGrades(before.filter(r=>!outdated.has(E.gradeKey(r))),[target],true).records;
assert.equal(E.overallGrade(after,a.registration,a.group,a.year,['Arte']).level.key,'adequate');
assert.deepEqual(E.gradeDelta(before,after).p_removed_grades,[{year:a.year,registration:a.registration,disciplineKey:'ED DIG COMP'}]);
