export function cameraErrorMessage(error){
 const messages={
  NotAllowedError:'Camera access is blocked. Allow Camera in your browser settings, then try again.',
  SecurityError:'Camera access is blocked by this browser. Open SkinScope in Safari or Chrome, or choose a photo.',
  NotFoundError:'No camera was found. Connect a camera or choose a photo.',
  NotReadableError:'The camera is busy or unavailable. Close other camera apps, then try again.',
  OverconstrainedError:'This camera could not use the requested mode. Try again or choose a photo.',
  UnsupportedError:'Live camera is unavailable in this browser. Open SkinScope in Safari or Chrome, or use the photo picker.',
  InsecureContextError:'Live camera needs a secure connection. Open the published SkinScope site or choose a photo.',
  CameraNotReady:'The camera is still starting. Wait for the preview, then take your photo.',
  CaptureError:'The photo could not be captured. Try again or choose a photo.'
 };
 return messages[error?.name]||'The camera could not start. Try again or choose a photo.';
}

function cameraError(name){const error=new Error(name);error.name=name;return error;}
const stopStream=stream=>stream?.getTracks().forEach(track=>track.stop());

export function createCamera({mediaDevices=globalThis.navigator?.mediaDevices,secureContext=globalThis.isSecureContext,makeCanvas=()=>document.createElement('canvas'),onEnded=()=>{}}={}){
 let stream=null,video=null,generation=0,facing='user';
 function stop(){
  generation++;
  stopStream(stream);stream=null;
  if(video){video.pause?.();video.srcObject=null;video=null;}
 }
 async function start(target,{facingMode=facing}={}){
  stop();const request=generation;
  if(!secureContext)throw cameraError('InsecureContextError');
  if(!mediaDevices?.getUserMedia)throw cameraError('UnsupportedError');
  let acquired;
  try{
   try{
    acquired=await mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440}}});
   }catch(error){
    if(request!==generation)return false;
    if(error.name!=='OverconstrainedError')throw error;
    acquired=await mediaDevices.getUserMedia({audio:false,video:true});
   }
   // Permission can finish after Cancel, navigation, or a newer camera request.
   if(request!==generation){stopStream(acquired);return false;}
   stream=acquired;video=target;
   facing=stream.getVideoTracks()[0]?.getSettings?.().facingMode||facingMode;
   video.muted=true;video.autoplay=true;video.playsInline=true;
   video.dataset.facing=facing;video.srcObject=stream;
   const track=stream.getVideoTracks()[0];
   track?.addEventListener?.('ended',()=>{if(request===generation){stop();onEnded();}},{once:true});
   await video.play();
   if(request!==generation)return false;
   return true;
  }catch(error){
   if(request!==generation)return false;
   stop();throw error;
  }
 }
 async function capture(){
  if(!stream||!video||!video.videoWidth||!video.videoHeight)throw cameraError('CameraNotReady');
  const canvas=makeCanvas(),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
  canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const context=canvas.getContext('2d');
  if(!context)throw cameraError('CaptureError');
  // Store the original orientation, not the mirrored selfie preview.
  context.drawImage(video,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
  if(!blob)throw cameraError('CaptureError');
  return blob;
 }
 return {start,stop,capture,flip:target=>start(target,{facingMode:facing==='user'?'environment':'user'}),get facing(){return facing;}};
}
