const color=s=>parseInt(String(s).replace('#',''),16)||0;
export function mixColor(a,b,p){const x=color(a),y=color(b);return [16,8,0].reduce((n,shift)=>n+(Math.round(((x>>shift)&255)*(1-p)+((y>>shift)&255)*p)<<shift),0);}
export function textOffset(distance,angle){const a=angle*Math.PI/180;return{x:Math.cos(a)*distance,y:Math.sin(a)*distance};}
export function makeWinText(value,cfg,fx,quality,maxWidth){
 const root=new PIXI.Container(),style={fontFamily:cfg.fontFamily,fontSize:cfg.fontSize,fontWeight:cfg.fontWeight,align:'center',letterSpacing:fx.letterSpacing,padding:4,lineJoin:'round'};
 const front=new PIXI.Text(String(value),{...style,fill:fx.gradientEnabled?[fx.topColor,fx.bottomColor]:cfg.color,fillGradientType:0});front.anchor.set(.5);front.resolution=quality.resolution;front.roundPixels=quality.roundPixels;
 // One white glyph stamp is shared by all depth/outline/glow sprites. Count-up
 // changes rasterize two glyph textures, rather than one per extrusion layer.
 const stamp=new PIXI.Text(String(value),{...style,fill:'#ffffff',stroke:'#ffffff',strokeThickness:fx.strokeEnabled?fx.strokeWidth*2:0});stamp.anchor.set(.5);stamp.resolution=quality.resolution;stamp.updateText(false);
 const layer=(tint,x=0,y=0,alpha=1,blur=0)=>{const sp=new PIXI.Sprite(stamp.texture);sp.anchor.set(.5);sp.tint=color(tint);sp.position.set(x,y);sp.alpha=alpha;sp.roundPixels=quality.roundPixels;if(blur>0)sp.filters=[new PIXI.BlurFilter(blur,2)];root.addChild(sp);return sp;};
 if(fx.glowEnabled){const sp=layer(fx.glowColor,0,0,fx.glowAlpha,fx.glowBlur);sp.blendMode=PIXI.BLEND_MODES.ADD;}
 if(fx.shadowEnabled){const o=textOffset(fx.shadowDistance,fx.shadowAngle);layer(fx.shadowColor,o.x,o.y,fx.shadowAlpha,fx.shadowBlur);}
 if(fx.extrusionEnabled){const depth=Math.max(1,Math.round(fx.depth));for(let d=depth;d>=1;d--){const o=textOffset(d,fx.depthAngle);layer('#'+mixColor(fx.depthNearColor,fx.depthFarColor,d/depth).toString(16).padStart(6,'0'),o.x,o.y);}}
 if(fx.strokeEnabled)layer(fx.strokeColor);
 if(fx.bevelEnabled)layer(fx.bevelColor,-fx.bevelSize,-fx.bevelSize,fx.bevelAlpha);
 root.addChild(front);root.front=front;root.stamp=stamp;root.eventMode='none';
 const fit=()=>{front.updateText(false);root.scale.set(1);const width=root.getLocalBounds().width;root.scale.set(Math.min(1,maxWidth/Math.max(1,width)));};
 Object.defineProperty(root,'text',{get:()=>front.text,set:v=>{const next=String(v);if(front.text===next)return;front.text=stamp.text=next;stamp.updateText(false);fit();}});
 const destroy=root.destroy.bind(root);root.destroy=options=>{if(root.destroyed)return;destroy(options);stamp.destroy({texture:true,baseTexture:true});};fit();return root;
}
