import test from 'node:test';
import assert from 'node:assert/strict';
import {createCamera,cameraErrorMessage} from '../app/camera.js';

function fakeStream(facing='user'){
 const track={stops:0,stop(){this.stops++;},getSettings:()=>({facingMode:facing}),addEventListener(name,callback){this[name]=callback;}};
 return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};
}
function fakeVideo(){return {srcObject:null,dataset:{},videoWidth:1920,videoHeight:1440,play:async()=>{},pause(){this.paused=true;}};}
function fixture(getUserMedia){
 const stream=fakeStream(),video=fakeVideo(),calls=[];
 const canvas={width:0,height:0,getContext:()=>({drawImage(...args){canvas.draw=args;}}),toBlob(callback,type,quality){canvas.type=type;canvas.quality=quality;callback(new Blob(['frame'],{type}));}};
 const camera=createCamera({secureContext:true,mediaDevices:{async getUserMedia(options){calls.push(options);return getUserMedia?getUserMedia(options):stream;}},makeCanvas:()=>canvas});
 return {camera,stream,video,calls,canvas};
}

test('starts a muted inline live preview and never requests audio',async()=>{
 const {camera,stream,video,calls}=fixture();
 assert.equal(await camera.start(video),true);
 assert.equal(video.srcObject,stream);assert.equal(video.muted,true);assert.equal(video.playsInline,true);
 assert.equal(calls[0].audio,false);assert.deepEqual(calls[0].video.facingMode,{ideal:'user'});
 assert.equal(video.dataset.facing,'user');camera.stop();
 assert.equal(stream.track.stops,1);assert.equal(video.srcObject,null);
});
test('cancel while permission is pending stops any late stream',async()=>{
 let grant;const pending=new Promise(resolve=>grant=resolve),{camera,video}=fixture(()=>pending),stream=fakeStream();
 const opening=camera.start(video);camera.stop();grant(stream);
 assert.equal(await opening,false);assert.equal(stream.track.stops,1);assert.equal(video.srcObject,null);
});
test('newer requests win and the superseded stream cannot attach',async()=>{
 let grant,count=0;const old=new Promise(resolve=>grant=resolve),first=fakeStream(),second=fakeStream('environment');
 const {camera,video}=fixture(()=>++count===1?old:second);
 const opening=camera.start(video);await camera.start(video,{facingMode:'environment'});grant(first);
 assert.equal(await opening,false);assert.equal(first.track.stops,1);assert.equal(video.srcObject,second);camera.stop();
});
test('switching stops the old stream before requesting the rear camera',async()=>{
 const streams=[fakeStream(),fakeStream('environment')];let count=0;
 const {camera,video,calls}=fixture(()=>streams[count++]);
 await camera.start(video);await camera.flip(video);
 assert.equal(streams[0].track.stops,1);assert.equal(calls[1].video.facingMode.ideal,'environment');
 assert.equal(video.dataset.facing,'environment');camera.stop();
});
test('unsupported and insecure browsers return actionable errors',async()=>{
 await assert.rejects(createCamera({secureContext:true,mediaDevices:{}}).start(fakeVideo()),{name:'UnsupportedError'});
 await assert.rejects(createCamera({secureContext:false}).start(fakeVideo()),{name:'InsecureContextError'});
 assert.match(cameraErrorMessage({name:'NotAllowedError'}),/Allow Camera/);
 assert.match(cameraErrorMessage({name:'NotReadableError'}),/Close other camera apps/);
});
test('permission refusal is not hidden by another prompt or a fake preview',async()=>{
 const error=Object.assign(new Error('denied'),{name:'NotAllowedError'}),{camera,video,calls}=fixture(()=>Promise.reject(error));
 await assert.rejects(camera.start(video),error);assert.equal(calls.length,1);assert.equal(video.srcObject,null);
});
test('an unsupported constraint retries a simple video-only request',async()=>{
 let count=0;const stream=fakeStream(),{camera,video,calls}=fixture(()=>++count===1?Promise.reject({name:'OverconstrainedError'}):stream);
 await camera.start(video);assert.deepEqual(calls[1],{audio:false,video:true});camera.stop();
});
test('failed playback releases the camera',async()=>{
 const {camera,stream,video}=fixture();video.play=async()=>{throw new Error('playback');};
 await assert.rejects(camera.start(video),/playback/);assert.equal(stream.track.stops,1);assert.equal(video.srcObject,null);
});
test('capture preserves orientation and aspect ratio without a black initial frame',async()=>{
 const {camera,video,canvas}=fixture();await assert.rejects(camera.capture(),{name:'CameraNotReady'});
 await camera.start(video);const blob=await camera.capture();
 assert.equal(blob.type,'image/jpeg');assert.equal(canvas.width,1600);assert.equal(canvas.height,1200);
 assert.deepEqual(canvas.draw,[video,0,0,1600,1200]);assert.equal(canvas.quality,.94);
 video.videoWidth=0;await assert.rejects(camera.capture(),{name:'CameraNotReady'});camera.stop();
});
test('empty canvas output is an error, not a saved empty photo',async()=>{
 const {camera,video,canvas}=fixture();canvas.toBlob=callback=>callback(null);
 await camera.start(video);await assert.rejects(camera.capture(),{name:'CaptureError'});camera.stop();
});
test('unexpected camera end stops the preview and notifies the UI once',async()=>{
 const stream=fakeStream(),video=fakeVideo();let ended=0;
 const camera=createCamera({secureContext:true,mediaDevices:{getUserMedia:async()=>stream},onEnded:()=>ended++});
 await camera.start(video);stream.track.ended();assert.equal(ended,1);assert.equal(video.srcObject,null);
 stream.track.ended();assert.equal(ended,1);
});
