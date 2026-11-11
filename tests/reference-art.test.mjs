import test from 'node:test';
import assert from 'node:assert/strict';
import {icon,art,courseFigure} from '../app/reference-art.js';

test('navigation and camera tools use vector paths instead of small bitmap masks',()=>{
 for(const name of ['home','photo','progress','leaderboard','profile','capture','edit','location','person','stats']){
  assert.match(icon(name),/^<svg/);assert.doesNotMatch(icon(name),/\.png|mask|<image/);
  assert.match(icon(name),/viewBox="0 0 24 24"/);
 }
});
test('course illustrations, rings and badges are vector at every screen density',()=>{
 for(const name of ['skin','concern','breakouts','feel','pores','tone','sun','product','sensitive','goal']){
  assert.match(courseFigure(name),/^<svg/);assert.doesNotMatch(courseFigure(name),/\.png|<image|<img/);
  assert.match(art(name),/^<svg/);assert.doesNotMatch(art(name),/\.png|<image|<img/);
 }
 assert.match(courseFigure('feel'),/course-level-mobile">2/);
 assert.match(courseFigure('feel'),/course-level-desktop">1/);
 assert.doesNotMatch(courseFigure('goal',{unlocked:true}),/translate\(92 91\)/);
 assert.match(art('normal'),/radialGradient/);
});
test('gradient IDs stay unique when multiple instances are on a page',()=>{
 const markup=art('skin')+courseFigure('skin')+art('podium')+art('feel');
 const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const [,id] of markup.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(id));
});
