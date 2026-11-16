import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const engine=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
globalThis.window={};vm.runInThisContext(engine);const E=window.Edu;
for(const [value,key] of [[0,'below'],[5.9,'below'],[6,'basic'],[6.9,'basic'],[7,'adequate'],[9,'adequate'],[10,'adequate']])assert.equal(E.gradeSummary([value,value,value]).level.key,key);
assert.equal(E.gradeSummary([null,null,null]).mean,null);
assert.equal(E.gradeSummary([null,null,null]).level.key,'missing');
assert.equal(E.gradeSummary([0,6,6]).mean,4);
assert.equal(E.gradeSummary([null,6,8]).mean,null);
assert.equal(E.gradeSummary([null,6,8]).level.key,'missing');
assert.equal(E.gradeSummary([null,6,8]).pointsMissing,null);
assert.equal(E.gradeSummary([0,6,6]).pointsMissing,6);
assert.equal(E.gradeSummary([6,6,6]).pointsMissing,0);
assert.equal(E.gradeSummary([7,7,7]).pointsMissing,-3);
assert.equal(E.gradeSummary([null,null,9]).count,1);
const word=(text,x,y)=>({text,x,y});
const imageRows=E.imageGradeRows(
 E.imageGradeStudents([word('MARIA',7,44),word('SOUZA -',52,45),word('1234567890',15,56),word('JOÃO - 0987654321 |',55,70)]),
 [word('0,0',221,44),word('7,5',246,44),word('19,9',295,44),word('8,0',221,70)]
);
assert.deepEqual(imageRows[0].slice(0,5),['1234567890','MARIA SOUZA','0,0','7,5','?']);
assert.deepEqual(imageRows[1].slice(0,5),['0987654321','JOÃO','8,0','?','?']);
assert.deepEqual(E.gradeDistribution([[5,5,5],[6,6,6],[8,8,8],[0,10,null],[null,null,null]]),{below:1,basic:1,adequate:1,missing:2});
assert.equal(E.gradeNumber(' 6,5 '),6.5);
for(const value of [-1,11,NaN,Infinity,'6x',true,'-','6,5,0'])assert.throws(()=>E.gradeNumber(value));
const record={year:2026,registration:'000123',name:'Estudante Teste',group:'9 A',discipline:'Matemática',notes:[6,7,8]};
assert.throws(()=>E.validateGrades([{...record,notes:['6',null,null]}]));
assert.throws(()=>E.validateGrades([record,{...record,discipline:'MATEMÁTICA'}]));
assert.throws(()=>E.validateGrades([record,{...record,discipline:'Arte',group:'9 B'}]));
const existing=[record,{...record,year:2025},{...record,discipline:'Arte'}];
let merged=E.mergeGrades(existing,[{...record,group:'9 B',notes:[null,0,10]}]);
assert.deepEqual(merged.records[0].notes,[6,0,10]);
assert.deepEqual(existing[0].notes,[6,7,8]);
assert.equal(merged.records[1].group,'9 A');
assert.equal(merged.records[2].group,'9 B');
assert.equal(merged.records.length,3);
assert.equal(E.mergeGrades(merged.records,[{...record,group:'9 B',notes:[null,0,10]}]).records.length,3);
const map={registration:0,discipline:1,t1:2,t2:3,t3:4};
const students=[{registration:'000123',name:'Estudante Teste',group:'9 A'}];
assert.deepEqual(E.parseGrades([['000123','Arte','',0,'9,0']],map,2026,students)[0].notes,[null,0,9]);
assert.throws(()=>E.parseGrades([['999','Arte',6]],map,2026,students));
assert.throws(()=>E.parseGrades([['000123','Arte',11]],map,2026,students));
assert.throws(()=>E.parseGrades([['000123','Arte',6],['000123','ARTE',7]],map,2026,students));
assert.throws(()=>E.parseGrades([['000123','Arte',6]],{...map,t2:2},2026,students));
assert.throws(()=>E.parseGrades([['000123','Arte',6]],map,1999,students));
for(const [,source] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)){if(source.trim().startsWith('{'))continue;new vm.Script(source);}
console.log('PASS: boundaries, missing grades, zero, validation, duplicates, identity, years, non-destructive merge and script syntax.');
