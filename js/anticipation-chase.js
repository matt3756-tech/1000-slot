const color=s=>parseInt(String(s).replace('#',''),16)||0;
// Distance along a rounded rectangle, in the reel frame's local coordinates.
export function roundedTrack(rect,radius){
 const r=Math.max(0,Math.min(radius,rect.w/2,rect.h/2)),w=rect.w-2*r,h=rect.h-2*r,a=Math.PI*r/2;
 const pieces=[['line',w,rect.x+r,rect.y,1,0],['arc',a,rect.x+rect.w-r,rect.y+r,-Math.PI/2],['line',h,rect.x+rect.w,rect.y+r,0,1],['arc',a,rect.x+rect.w-r,rect.y+rect.h-r,0],['line',w,rect.x+rect.w-r,rect.y+rect.h,-1,0],['arc',a,rect.x+r,rect.y+rect.h-r,Math.PI/2],['line',h,rect.x,rect.y+rect.h-r,0,-1],['arc',a,rect.x+r,rect.y+r,Math.PI]];
 const length=2*(w+h)+4*a;
 return{length,point(distance){let d=((distance%length)+length)%length;for(const [kind,len,x,y,u,v]of pieces){if(d<=len&&len>0)return kind==='line'?{x:x+u*d,y:y+v*d}:{x:x+r*Math.cos(u+d/r),y:y+r*Math.sin(u+d/r)};d-=len;}return{x:rect.x+r,y:rect.y};}};
}
export class AnticipationChase{
 constructor(render){
  this.render=render;this.root=new PIXI.Container();this.root.eventMode='none';render.slot.addChild(this.root);
  this.reels=Array.from({length:3},()=>{const c=new PIXI.Container(),halo=new PIXI.Graphics(),trail=new PIXI.Graphics();c.addChild(halo,trail);halo.filters=[new PIXI.BlurFilter(6,2)];halo.blendMode=trail.blendMode=PIXI.BLEND_MODES.ADD;this.root.addChild(c);return{c,halo,trail};});this.active=[];this.started=performance.now();
 }
 set(reels){if(!this.active.length&&reels.length)this.started=performance.now();this.active=reels;this.root.visible=reels.length>0&&this.render.settings.anticipationChase.enabled;}
 update(){
  const cfg=this.render.settings.anticipationChase;this.root.visible=cfg.enabled&&this.active.length>0;if(!this.root.visible)return;
  const phase=(performance.now()-this.started)/Math.max(1,cfg.duration),heads=Math.max(1,Math.round(cfg.heads));
  this.reels.forEach(({c,halo,trail},reel)=>{
   c.visible=this.active.includes(reel);if(!c.visible)return;const o=this.render.opening(reel),p=cfg.padding,rect={x:o.x-p,y:o.y-p,w:Math.max(2,o.w+2*p),h:Math.max(2,o.h+2*p)},radius=Math.min(cfg.radius,rect.w/2,rect.h/2),track=roundedTrack(rect,radius);
   halo.clear();trail.clear();c.alpha=cfg.alpha;
   halo.lineStyle(cfg.glowWidth,color(cfg.color),cfg.baseAlpha*.7).drawRoundedRect(rect.x,rect.y,rect.w,rect.h,radius);
   trail.lineStyle(cfg.width,color(cfg.color),cfg.baseAlpha).drawRoundedRect(rect.x,rect.y,rect.w,rect.h,radius);
   for(let head=0;head<heads;head++){
    const end=(phase+head/heads)*track.length,steps=40;
    for(let i=0;i<steps;i++){
     const q=i/steps,a=track.point(end-track.length*cfg.tailLength*(1-q)),b=track.point(end-track.length*cfg.tailLength*(1-(i+1)/steps)),alpha=(.08+.92*q*q);
     halo.lineStyle(cfg.glowWidth,color(cfg.color),alpha*.75).moveTo(a.x,a.y).lineTo(b.x,b.y);
     trail.lineStyle(cfg.width,color(cfg.color),alpha).moveTo(a.x,a.y).lineTo(b.x,b.y);
     if(q>.75)trail.lineStyle(cfg.width*.45,color(cfg.coreColor),(q-.75)*4).moveTo(a.x,a.y).lineTo(b.x,b.y);
    }
    const tip=track.point(end);trail.beginFill(color(cfg.coreColor)).drawCircle(tip.x,tip.y,cfg.width*.8).endFill();
   }
  });
 }
}
