import {icon} from './icons.js?v=soap-2';

export function createWelcome({onEnter}) {
 const welcome=document.querySelector('#welcome');
 const audio=document.querySelector('#welcomeAudio');
 const soundButton=document.querySelector('#welcomeSound');
 const surfaces=['.app-shell','.desktop-nav','#bottomNav'].map(s=>document.querySelector(s));
 let entering=false;
 let sound=true;
 try {sound=localStorage.getItem('skinscope.welcomeSound')!=='off';} catch {}

 function updateSound() {
  soundButton.innerHTML=icon(sound?'volume':'muted');
  soundButton.setAttribute('aria-pressed',String(sound));
  soundButton.setAttribute('aria-label',sound?'Mute welcome sound':'Enable welcome sound');
  soundButton.title=sound?'Mute welcome sound':'Enable welcome sound';
 }
 function finish() {
  welcome.hidden=true;
  welcome.classList.remove('dispensing','leaving');
  document.body.classList.remove('intro-open');
  surfaces.forEach(surface=>{surface.inert=false;});
  audio.pause();
  audio.currentTime=0;
  entering=false;
  onEnter();
  document.querySelector('#main').focus({preventScroll:true});
 }
 function show() {
  if(entering)return;
  welcome.hidden=false;
  welcome.classList.remove('dispensing','leaving');
  document.body.classList.add('intro-open');
  surfaces.forEach(surface=>{surface.inert=true;});
  welcome.tabIndex=-1;
  welcome.focus();
 }
 function enter(skip=false) {
  if(entering)return;
  entering=true;
  if(skip){finish();return;}
  // Start only inside the tap gesture, so mobile browsers can allow playback.
  if(sound){audio.volume=.34;audio.currentTime=0;audio.play().catch(()=>{});}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){setTimeout(finish,450);return;}
  welcome.classList.add('dispensing');
  setTimeout(()=>welcome.classList.add('leaving'),1450);
  setTimeout(finish,2250);
 }
 soundButton.addEventListener('click',()=>{
  sound=!sound;
  try {localStorage.setItem('skinscope.welcomeSound',sound?'on':'off');} catch {}
  if(!sound)audio.pause();
  updateSound();
 });
 document.querySelector('#bottleButton').addEventListener('click',()=>enter());
 document.querySelector('#skipWelcome').addEventListener('click',()=>enter(true));
 document.querySelector('#replayIntro').addEventListener('click',show);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!welcome.hidden)enter(true);});
 updateSound();
 return {show,enter};
}
