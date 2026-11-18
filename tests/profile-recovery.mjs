import './seliga.mjs';
import assert from 'node:assert/strict';
const E=window.Edu;
const base={id:'a',registration:'001',name:'Nome Teste',documents:{},sources:{},history:[{confirmedIdentity:{registration:'001',name:'Nome Teste'},confirmedFields:{birth:'2012-07-13',phone:'(45) 99999-0000'},changes:[]}]};
const original=structuredClone(base),r=E.recoverStudentProfile([base]);
assert.equal(r.recovered,1);assert.equal(r.fieldsRecovered,2);assert.equal(r.students[0].id,'a');
assert.equal(r.students[0].birth,'2012-07-13');assert.equal(r.students[0].phone,'(45) 99999-0000');assert.deepEqual(base,original);
assert.equal(E.metrics(r.students[0],2026).ageAtYear,14);
assert.equal(E.recoverStudentProfile(r.students).recovered,0);
const existing={...base,birth:'2011-01-01',phone:'(45) 98888-0000'};
assert.equal(E.recoverStudentProfile([existing]).recovered,0);
const cleared={...base,history:[...base.history,{source:'Ficha do aluno',changes:[{field:'birth',afterValue:null},{field:'phone',afterValue:''}]}]};
assert.equal(E.recoverStudentProfile([cleared]).recovered,0);
const corrected={...base,history:[...base.history,{source:'Ficha do aluno',changes:[{field:'phone',afterValue:'(45) 97777-0000'}]}]};
assert.equal(E.recoverStudentProfile([corrected]).students[0].phone,'(45) 97777-0000');
const wrong={...base,registration:'002'};
assert.equal(E.recoverStudentProfile([wrong]).recovered,0);
for(const fields of [{birth:'3000-01-01',phone:'??'},{birth:'31/02/2012',phone:'123'}]){
 const invalid={...base,history:[{confirmedIdentity:{registration:'001'},confirmedFields:fields}]};
 assert.equal(E.recoverStudentProfile([invalid]).recovered,0);
}
const incoming={registration:'001',name:'Nome Teste',birth:'2012-07-13',phone:'(45) 99999-0000'};
const merged=E.mergeStudentDatasets([r.students[0]],[incoming],'Relatorio',true,'import',true);
assert.deepEqual(merged.students[0].history.at(-1).confirmedFields,{birth:incoming.birth,phone:incoming.phone});
console.log('PASS: contact/birth recovery, derived age, original IDs, audit, existing values and deliberate blanks preserved; invalid/wrong-CGM sources rejected; import snapshots retained.');
