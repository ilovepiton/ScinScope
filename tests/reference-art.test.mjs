import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {icon,art,courseFigure} from '../app/reference-art.js';

test('inline icon masks use module-absolute URLs, not stylesheet-relative paths',()=>{
 assert.ok(icon('capture').includes(new URL('../app/reference/icon-camera-outline.png',import.meta.url).href));
 assert.ok(icon('edit').includes(new URL('../app/reference/icon-edit.png',import.meta.url).href));
});
test('original mobile and desktop course art are selected separately',()=>{
 assert.match(courseFigure('skin'),/mobile-skin\.png/);assert.match(courseFigure('skin'),/course-skin\.png/);
 assert.doesNotMatch(courseFigure('goal',{unlocked:true}),/course-goal\.png/);
 assert.match(art('normal'),/small-skin\.png/);
});
test('all literal course illustrations and navigation masks exist',async()=>{
 const names=['skin','concern','breakouts','feel','pores','tone','sun','product','sensitive','goal'];
 for(const name of names)await access(new URL(`../app/reference/course-${name}.png`,import.meta.url));
 for(const name of ['home','photo','progress','profile'])await access(new URL(`../app/reference/icon-${name}.png`,import.meta.url));
});
