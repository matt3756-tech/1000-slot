import {mediaSource} from './assets.js';

export const WIN_CUES = { mixed: 'winMixed', coin10: 'win10', coin100: 'win100', coin1000: 'win1000' };
export const LAND_CUES = { coin10: 'land10', coin100: 'land100', coin1000: 'land1000' };
export const SFX_LABELS = {
 click: 'UI click', spinStart: 'Spin press', reelLoop: 'Reels spinning',
 stop: 'Reel stop', anticipate: 'Anticipation', win: 'Amount count-up', mixedLineWin: 'Mixed line win count-up',
 winMixed: 'Mixed win pop', win10: '10 win pop', win100: '100 win pop', win1000: '1000 win pop',
 land10: '10 coin land', land100: '100 coin land', land1000: '1000 coin land', bonusWon: 'Bonus won bell'
};
const MUSIC_TRACKS = { base: 'music', bigWin: 'bigWinMusic', jackpot: 'jackpotMusic' };
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
  this.startMusic();
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
   if(target>0){
    if (this.music !== track && track.kind !== 'music') track.element.currentTime = 0;
    this.music=track;if(track.element.paused)track.element.play().catch(()=>{});
   }
   else{track.pauseTimer=setTimeout(()=>{track.element.pause();if(this.music===track)this.music=null;},Math.ceil(fade*1000)+25);}
  }
 }
 async unlock(){
  try{const c=this.createContext();
   // Prime the music elements inside the gesture before awaiting resume.
   if(!this.unlocked){this.unlocked=true;for(const track of Object.values(this.tracks)){const played=track.element.play();played?.then(()=>{if(this.music!==track)track.element.pause();}).catch(()=>{this.unlocked=false;});}}
   if(c.state!=='running'){const resumed=c.resume();resumed.then(()=>this.startMusic()).catch(()=>{});}this.startMusic();
  }catch{/* An unavailable audio device must never block a spin. */}
 }
 async loadMedia(media, strict = false) {
  this.media = media;
  const entries = Object.entries(media).filter(([key]) => key.startsWith('audio:'));
  await Promise.all(entries.map(async ([key, data]) => {
   const kind = key.slice(6);
   try {
    if (Object.values(MUSIC_TRACKS).includes(kind)) {
     await this.prepareMusic(kind, data);
    } else {
     const context = this.createContext();
     const response = await fetch(mediaSource(data), { cache: 'no-store' });
     if (!response.ok) throw Error('Cannot load sound: ' + data);
     this.buffers[kind] = await context.decodeAudioData(await response.arrayBuffer());
    }
   } catch (error) {
    if (strict) throw error;
    console.warn('Custom sound could not be decoded', key);
   }
  }));
  this.startMusic();
 }
 setMode(mode){this.mode=mode;this.startMusic();}
 startMusic(){
  if (!this.started || this.ctx?.state !== 'running') return;
  const config = this.getSettings().audio;
  const kind = MUSIC_TRACKS[this.mode];
  let volume = 0;
  if (config.enabled && kind === 'music' && config.musicEnabled && this.preferences.music) {
    volume = config.musicVolume * (this.preferences.musicLevel ?? 1);
  } else if (config.enabled && kind && kind !== 'music' && this.preferences.sfx) {
    volume = config.sfxVolume * (config[kind + 'Volume'] ?? 1) * (this.preferences.sfxLevel ?? 1);
  }
  this.startStream(kind, volume, (config.fadeDuration ?? 400) / 1000);
 }
 stopAnticipation(){if(this.anticipationSource){const voice=[...this.voices].find(v=>v.source===this.anticipationSource);if(voice)voice.cancel();else try{this.anticipationSource.stop();}catch{}this.anticipationSource=null;}}
 // Advance known future events; zero/positive timings remain tied to the actual rendered event.
 advance(kind,eventInMs){const timing=this.getSettings().audio[kind+'TimingMs']??0;if(timing>=0)return null;if(kind==='anticipate'){let voice;const timer=setTimeout(()=>voice=this.play(kind),Math.max(0,eventInMs+timing));return{cancel:()=>{clearTimeout(timer);voice?.cancel();}};}return this.play(kind,{eventInMs});}
 async present(kind,visual){const timing=this.getSettings().audio[kind+'TimingMs']??0,voice=this.play(kind);if(timing<0&&voice.audible)await new Promise(r=>setTimeout(r,-timing));visual();return voice;}
 play(kind, { eventInMs = 0, loopForMs = 0, rate = 1 } = {}) {
  const settings = this.getSettings();
  const config = settings.audio;
  const context = this.ctx;
  const volume = config.sfxVolume * (this.preferences.sfxLevel ?? 1) * (config[kind + 'Volume'] ?? 1);
  const silent = () => ({ audible: false, done: Promise.resolve(), cancel() {}, duration: 0 });
  if (!config.enabled || !this.preferences.sfx || context?.state !== 'running' || volume <= 0) return silent();

  const buffer = this.buffers[kind];
  const now = context.currentTime;
  const when = now + cueDelay(eventInMs, config[kind + 'TimingMs'] ?? 0);
  const loopEnd = now + loopForMs / 1000;
  const loop = loopForMs > 0;
  if (loop && (!buffer || loopEnd <= when)) return silent();

  const maxVoices = Math.max(6, Math.floor(settings.performance?.maxVoices ?? 24));
  while (this.voices.size >= maxVoices) this.voices.values().next().value.cancel();
  const gain = context.createGain();
  const source = buffer ? context.createBufferSource() : context.createOscillator();
  source.connect(gain);
  gain.connect(context.destination);
  const rawOffset = (config[kind + 'OffsetMs'] ?? 0) / 1000;
  const offset = buffer ? loop ? rawOffset % buffer.duration : Math.min(rawOffset, Math.max(0, buffer.duration - .001)) : 0;
  let resolve, finished = false;
  const ticket = {
   kind, source, when, audible: true,
   done: new Promise(done => { resolve = done; }),
   duration: loop ? loopEnd - when : buffer ? (buffer.duration - offset) / rate : .17
  };
  const finish = () => {
   if (finished) return;
   finished = true;
   this.voices.delete(ticket);
   source.disconnect();
   gain.disconnect();
   if (this.anticipationSource === source) this.anticipationSource = null;
   resolve();
  };
  ticket.cancel = () => {
   try { source.stop(); } catch {}
   finish();
  };
  source.onended = finish;
  this.voices.add(ticket);
  if (kind === 'anticipate') {
   this.stopAnticipation();
   this.anticipationSource = source;
  }
  if (buffer) {
   source.buffer = buffer;
   source.loop = loop;
   if (rate !== 1) source.playbackRate.value = rate;
   if (loop) {
    const fade = Math.min(.028, (loopEnd - when) / 3);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + fade);
    gain.gain.setValueAtTime(volume, loopEnd - fade);
    gain.gain.linearRampToValueAtTime(0, loopEnd);
    source.start(when, offset);
    source.stop(loopEnd);
   } else {
    gain.gain.value = volume;
    source.start(when, offset);
   }
  } else {
   source.type = kind === 'stop' ? 'triangle' : 'sine';
   const frequency = (config[kind + 'Frequency'] || 650) * rate;
   source.frequency.setValueAtTime(frequency, when);
   source.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * (kind === 'win' ? 1.5 : .5)), when + .12);
   gain.gain.setValueAtTime(volume * .16, when);
   gain.gain.exponentialRampToValueAtTime(.001, when + .16);
   source.start(when);
   source.stop(when + .17);
  }
  return ticket;
 }
}
