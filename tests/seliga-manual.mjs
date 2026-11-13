import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');globalThis.window={};vm.runInThisContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);const E=window.Edu;
const r={year:2026,registration:'001',name:'Teste',group:'6 A',discipline:'Arte',notes:[0,null,8],manual:[true,true,false]};
assert.equal(E.gradeSummary(r.notes).mean,4);
const merged=E.mergeGrades([r],[{...r,notes:[9,9,9],manual:undefined}]).records[0];
assert.deepEqual(merged.notes,[0,null,9]);assert.deepEqual(merged.manual,[true,true,false]);
assert.deepEqual(E.mergeGrades([{...r,manual:[false,false,false]}],[{...r,notes:[9,9,9]}]).records[0].notes,[9,9,9]);
assert.equal(E.mergeGrades([r],[{...r,discipline:'Matemática',notes:[8,8,8]}]).records.length,2);
assert.deepEqual(E.gradeDelta([], [r]).p_grades[0].manual,[true,true,false]);
assert.equal(E.gradeDelta([r],[{...r,manual:[false,true,false]}]).p_grades.length,1);
for(const manual of [[true],['true',false,false],null]){if(manual)assert.throws(()=>E.validateGrades([{...r,manual}]));}
console.log('PASS: zero, blank, protected trimesters, import release, distinct disciplines and cloud delta.');
