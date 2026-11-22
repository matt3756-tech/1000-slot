import {mediaSource} from './assets.js';
const AUDIO_PREFERENCE_KEY='coin10s.player.audio.v1';
export function loadAudioPreferences(){try{const p=JSON.parse(localStorage.getItem(AUDIO_PREFERENCE_KEY)||'null');return{sfx:p?.sfx!==false,music:p?.music!==false,sfxLevel:parseLevel(p?.sfxLevel),musicLevel:parseLevel(p?.musicLevel)};}catch{return{sfx:true,music:true};}}
const parseLevel = value => Number.isFinite(value) ? Math.min(1,Math.max(0,value)) : 1;
export const cueDelay=(eventInMs,timingMs)=>Math.max(0,eventInMs+timingMs)/1000;
export class AudioSystem{
 constructor(getSettings){this.getSettings=getSettings;this.preferences=loadAudioPreferences();this.ctx=null;this.buffers={};this.anticipationSource=null;this.music=null;this.mode='base';this.media={};this.voices=new Set();this.tracks={};this.unlocked=false;this.started=false;this.installLifecycle();}
 setPreference(kind,enabled){if(!['sfx','music'].includes(kind))return;this.preferences[kind]=Boolean(enabled);try{localStorage.setItem(AUDIO_PREFERENCE_KEY,JSON.stringify(this.preferences));}catch{}if(kind==='sfx'&&!enabled){for(const voice of [...this.voices])voice.cancel();this.stopAnticipation();}this.startMusic();}
 setLevel(kind,level) {
  if (!['sfx','music'].includes(kind)) return;
  this.preferences[kind+'Level']=parseLevel(level);
  try { localStorage.setItem(AUDIO_PREFERENCE_KEY,JSON.stringify(this.preferences)); } catch {}
  if (kind==='music') this.startMusic();
 }
 createContext(){if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});return this.ctx;}
 installLifecycle(){
  if(typeof document==='undefined')return;
  const resume=()=>{if(this.started&&!document.hidden)this.unlock();};
  document.addEventListener('pointerdown',resume,{capture:true,passive:true});document.addEventListener('touchend',resume,{capture:true,passive:true});document.addEventListener('keydown',resume,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const voice of [...this.voices])voice.cancel();for(const track of Object.values(this.tracks))track.element.pause();this.ctx?.suspend().catch(()=>{});}else resume();});window.addEventListener('pageshow',resume);
 }
 async prepareMusic(kind,data){
  const old=this.tracks[kind];if(old?.data===data)return;
  if(old){clearTimeout(old.pauseTimer);old.element.pause();old.node.disconnect();old.gain.disconnect();old.element.removeAttribute('src');old.element.load();if(old.objectUrl)URL.revokeObjectURL(old.objectUrl);if(this.music===old)this.music=null;}
  const c=this.createContext(),element=new Audio();element.preload='auto';element.loop=true;element.playsInline=true;element.setAttribute('playsinline','');const response=await fetch(mediaSource(data),{cache:'no-store'});if(!response.ok)throw Error('Cannot load music: '+data);
  const objectUrl=URL.createObjectURL(await response.blob());element.src=objectUrl;
  const gain=c.createGain();gain.gain.value=0;const node=c.createMediaElementSource(element);node.connect(gain);gain.connect(c.destination);
  const track={kind,data,element,node,gain,objectUrl,source:{stop:()=>element.pause()}};this.tracks[kind]=track;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('Music preload timed out: '+kind)),15000);const ready=()=>finish(),error=()=>finish(Error('Cannot load music: '+kind));const finish=e=>{clearTimeout(timer);element.removeEventListener('loadedmetadata',ready);element.removeEventListener('error',error);e?reject(e):resolve();};element.addEventListener('loadedmetadata',ready);element.addEventListener('error',error);element.load();});
 }
 startStream(kind,volume,fade){
  const c=this.ctx;
  for(const track of Object.values(this.tracks)){
   const target=track.kind===kind?volume:0;clearTimeout(track.pauseTimer);const gain=track.gain.gain;gain.cancelScheduledValues(c.currentTime);gain.setValueAtTime(gain.value,c.currentTime);gain.linearRampToValueAtTime(target,c.currentTime+fade);
   if(target>0){this.music=track;if(track.element.paused)track.element.play().catch(()=>{});}
   else{track.pauseTimer=setTimeout(()=>{track.element.pause();if(this.music===track)this.music=null;},Math.ceil(fade*1000)+25);}
  }
 }
 async unlock(){
  try{const c=this.createContext();
   // Prime both native music elements inside the gesture before awaiting resume.
   if(!this.unlocked){this.unlocked=true;for(const track of Object.values(this.tracks)){const played=track.element.play();played?.then(()=>{if(this.music!==track)track.element.pause();}).catch(()=>{this.unlocked=false;});}}
   if(c.state!=='running'){const resumed=c.resume();resumed.then(()=>this.startMusic()).catch(()=>{});}this.startMusic();
  }catch{/* An unavailable audio device must never block a spin. */}
 }
 async loadMedia(media,strict=false){this.media=media;for(const[key,data]of Object.entries(media)){if(key.startsWith('audio:')){try{
  const kind=key.slice(6);if(kind==='music'||kind==='bonusMusic'){await this.prepareMusic(kind,data);continue;}
  const c=this.createContext(),response=await fetch(mediaSource(data),{cache:'no-store'});if(!response.ok)throw Error(`Cannot load sound: ${data}`);const bytes=await response.arrayBuffer();this.buffers[kind]=await c.decodeAudioData(bytes);
 }catch(e){if(strict)throw e;console.warn('Custom sound could not be decoded',key);}}}this.startMusic();}
 setMode(mode){this.mode=mode;this.startMusic();}
 startMusic(){
  const settings=this.getSettings(),s=settings.audio,bonus=settings.bonusPresentation||{},kind=this.mode==='bonus'?'bonusMusic':'music',enabled=s.enabled&&this.preferences.music&&(this.mode==='bonus'?bonus.musicEnabled:s.musicEnabled),volume=enabled?(this.mode==='bonus'?bonus.musicVolume:s.musicVolume)*(this.preferences.musicLevel??1):0;
  if(!this.started||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,fade=(s.fadeDuration??400)/1000;if(this.tracks[kind]){this.startStream(kind,volume,fade);return;}
  if(this.music&&(this.music.kind!==kind||this.music.buffer!==this.buffers[kind])){
   const old=this.music;this.music=null;old.gain.gain.cancelScheduledValues(c.currentTime);old.gain.gain.setValueAtTime(old.gain.gain.value,c.currentTime);old.gain.gain.linearRampToValueAtTime(0,c.currentTime+fade);try{old.source.stop(c.currentTime+fade);}catch{}old.source.onended=()=>{old.source.disconnect();old.gain.disconnect();};
  }
  if(!this.music&&this.buffers[kind]&&volume>0){const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers[kind];source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(c.destination);source.start();this.music={source,gain,kind,buffer:this.buffers[kind]};}
  if(this.music){const gain=this.music.gain.gain;gain.cancelScheduledValues(c.currentTime);gain.setValueAtTime(gain.value,c.currentTime);gain.linearRampToValueAtTime(volume,c.currentTime+fade);}
 }
 stopAnticipation(){if(this.anticipationSource){const voice=[...this.voices].find(v=>v.source===this.anticipationSource);if(voice)voice.cancel();else try{this.anticipationSource.stop();}catch{}this.anticipationSource=null;}}
 // Advance known future events; zero/positive timings remain tied to the actual rendered event.
 advance(kind,eventInMs){const timing=this.getSettings().audio[kind+'TimingMs']??0;if(timing>=0)return null;if(kind==='anticipate'){let voice;const timer=setTimeout(()=>voice=this.play(kind),Math.max(0,eventInMs+timing));return{cancel:()=>{clearTimeout(timer);voice?.cancel();}};}return this.play(kind,{eventInMs});}
 async present(kind,visual){const timing=this.getSettings().audio[kind+'TimingMs']??0,voice=this.play(kind);if(timing<0&&voice.audible)await new Promise(r=>setTimeout(r,-timing));visual();return voice;}
 play(kind,{eventInMs=0}={}){
  const s=this.getSettings().audio,c=this.ctx,volume=s.sfxVolume*(this.preferences.sfxLevel??1)*(s[kind+'Volume']??1);
  if(!s.enabled||!this.preferences.sfx||!c||c.state!=='running'||volume<=0)return{audible:false,done:Promise.resolve(),cancel(){},duration:0};
  const max=Math.max(6,Math.floor(this.getSettings().performance?.maxVoices??24));while(this.voices.size>=max)this.voices.values().next().value.cancel();
  const g=c.createGain();g.connect(c.destination);const when=c.currentTime+cueDelay(eventInMs,s[kind+'TimingMs']??0),buffer=this.buffers[kind],n=buffer?c.createBufferSource():c.createOscillator();n.connect(g);
  let resolve,finished=false;const ticket={kind,source:n,when,audible:true,done:new Promise(r=>resolve=r),duration:buffer?Math.max(.001,buffer.duration-Math.min(buffer.duration-.001,(s[kind+'OffsetMs']??0)/1000)):.17};
  const finish=()=>{if(finished)return;finished=true;this.voices.delete(ticket);try{n.disconnect();g.disconnect();}catch{}if(this.anticipationSource===n)this.anticipationSource=null;resolve();};
  ticket.cancel=()=>{try{n.stop();}catch{}finish();};n.onended=finish;this.voices.add(ticket);
  if(kind==='anticipate'){this.stopAnticipation();this.anticipationSource=n;}
  if(buffer){n.buffer=buffer;g.gain.value=volume;n.start(when,Math.min(Math.max(0,buffer.duration-.001),(s[kind+'OffsetMs']??0)/1000));}
  else{n.type=kind==='stop'?'triangle':'sine';const freq=s[kind+'Frequency']||650;n.frequency.setValueAtTime(freq,when);n.frequency.exponentialRampToValueAtTime(Math.max(50,freq*(kind==='win'||kind==='bonus'?1.5:.5)),when+.12);g.gain.setValueAtTime(volume*.16,when);g.gain.exponentialRampToValueAtTime(.001,when+.16);n.start(when);n.stop(when+.17);}
  return ticket;
 }
}
