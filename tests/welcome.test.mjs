import test from 'node:test';
import assert from 'node:assert/strict';
import {createWelcome} from '../app/welcome.js';

function fixture({muted=false,reduced=false,blocked=false}={}) {
 const originals=Object.fromEntries(['document','localStorage','matchMedia','setTimeout'].map(k=>[k,globalThis[k]]));
 const classes=()=>{const values=new Set();return {add:(...keys)=>keys.forEach(k=>values.add(k)),remove:(...keys)=>keys.forEach(k=>values.delete(k)),contains:key=>values.has(key)};};
 const element=()=>({hidden:true,inert:false,classList:classes(),attributes:{},events:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;}});
 const ids=['#welcome','#welcomeAudio','#welcomeSound','.app-shell','.desktop-nav','#bottomNav','#main','#bottleButton','#skipWelcome','#replayIntro'];
 const nodes=Object.fromEntries(ids.map(id=>[id,element()])),timers=[];
 let plays=0,pauses=0,entered=0,value=muted?'off':'on';
 Object.assign(nodes['#welcomeAudio'],{currentTime:0,play(){plays++;return blocked?Promise.reject(new Error('Blocked')):Promise.resolve();},pause(){pauses++;}});
 globalThis.document={querySelector:id=>nodes[id],body:element(),addEventListener(){}};
 globalThis.localStorage={getItem:()=>value,setItem:(_k,v)=>{value=v;}};
 globalThis.matchMedia=()=>({matches:reduced});
 globalThis.setTimeout=(fn,delay)=>{timers.push({fn,delay});};
 const controller=createWelcome({onEnter(){entered++;}});
 return {controller,nodes,timers,get plays(){return plays;},get pauses(){return pauses;},get entered(){return entered;},get soundSetting(){return value;},restore(){for(const[k,v]of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}

test('welcome does not autoplay, and Skip never plays audio',()=>{
 const f=fixture();try{f.controller.show();assert.equal(f.plays,0);assert.equal(f.nodes['.app-shell'].inert,true);f.controller.enter(true);assert.equal(f.plays,0);assert.equal(f.nodes['#welcome'].hidden,true);assert.equal(f.nodes['.app-shell'].inert,false);assert.equal(f.entered,1);}finally{f.restore();}
});
test('one tap starts one quiet sound and completes the cream transition',()=>{
 const f=fixture();try{f.controller.show();f.controller.enter();f.controller.enter();assert.equal(f.plays,1);assert.equal(f.nodes['#welcomeAudio'].volume,.34);assert.equal(f.nodes['#welcome'].classList.contains('dispensing'),true);assert.deepEqual(f.timers.map(t=>t.delay),[1450,2250]);f.timers[0].fn();assert.equal(f.nodes['#welcome'].classList.contains('leaving'),true);f.timers[1].fn();assert.equal(f.nodes['#welcome'].hidden,true);assert.equal(f.entered,1);assert.equal(f.nodes['#main'].focused,true);}finally{f.restore();}
});
test('mute is remembered and suppresses playback',()=>{
 const f=fixture();try{f.nodes['#welcomeSound'].events.click();assert.equal(f.soundSetting,'off');assert.equal(f.nodes['#welcomeSound'].attributes['aria-pressed'],'false');f.controller.enter();assert.equal(f.plays,0);}finally{f.restore();}
});
test('reduced motion avoids the pump, cream and white transition animations',()=>{
 const f=fixture({reduced:true});try{f.controller.show();f.controller.enter();assert.equal(f.nodes['#welcome'].classList.contains('dispensing'),false);assert.deepEqual(f.timers.map(t=>t.delay),[450]);f.timers[0].fn();assert.equal(f.nodes['#welcome'].hidden,true);}finally{f.restore();}
});
test('blocked audio does not prevent entry into the app',async()=>{
 const f=fixture({blocked:true});try{f.controller.show();f.controller.enter();await Promise.resolve();f.timers[1].fn();assert.equal(f.entered,1);}finally{f.restore();}
});
