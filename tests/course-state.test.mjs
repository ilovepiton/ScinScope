import test from 'node:test';
import assert from 'node:assert/strict';
import {coreCompleted,isCourseLocked,dailyGoalCount} from '../app/course-state.js';

const firstEight=['skin','concern','breakouts','feel','pores','tone','sun','product'];
test('only the final two courses start locked',()=>{
 for(const id of firstEight)assert.equal(isCourseLocked(id,{}),false);
 assert.equal(isCourseLocked('sensitive',{}),true);assert.equal(isCourseLocked('goal',{}),true);
});
test('all eight completed core tests unlock the last pair',()=>{
 const tests=Object.fromEntries(firstEight.map(id=>[id,{completedAt:'2026-11-11T10:00:00Z'}]));
 assert.equal(coreCompleted(tests),8);assert.equal(isCourseLocked('goal',tests),false);assert.equal(isCourseLocked('sensitive',tests),false);
 delete tests.product;assert.equal(isCourseLocked('goal',tests),true);
});
test('previously completed courses are never relocked',()=>{
 assert.equal(isCourseLocked('goal',{goal:{completedAt:'2026-11-01T10:00:00Z'}}),false);
});
test('daily goal only counts actual test activity on the current local day',()=>{
 const now=new Date(2026,10,11,12),today=new Date(2026,10,11,9).toISOString(),yesterday=new Date(2026,10,10,9).toISOString();
 assert.equal(dailyGoalCount([],now),0);
 assert.equal(dailyGoalCount([{type:'photo',date:today},{type:'test',date:yesterday}],now),0);
 assert.equal(dailyGoalCount([{type:'test',date:'invalid'}],now),0);
 assert.equal(dailyGoalCount([{type:'test',date:today},{type:'test',date:today}],now),1);
});
