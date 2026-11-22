// Snap in canvas space, including elements inside transformed layout groups.
export function snapPoint(point,cfg,parent=null){
 if(!cfg?.snapEnabled)return{x:Math.round(point.x),y:Math.round(point.y)};
 const p=parent?parent.toGlobal(point):point,size=Math.max(1,cfg.size),snap=(value,origin)=>origin+Math.round((value-origin)/size)*size;
 const aligned={x:snap(p.x,cfg.offsetX),y:snap(p.y,cfg.offsetY)};
 return parent?parent.toLocal(aligned):aligned;
}
export class EditorGrid{
 constructor(render){this.render=render;this.graphic=new PIXI.Graphics();this.graphic.eventMode='none';render.app.stage.addChild(this.graphic);}
 apply(){const r=this.render,cfg=r.settings.editorGrid,g=this.graphic;g.clear();g.visible=r.editMode&&cfg.showGrid;if(!g.visible)return;const size=Math.max(5,cfg.size),first=offset=>((offset%size)+size)%size;
  g.lineStyle(cfg.lineWidth,parseInt(cfg.color.slice(1),16),cfg.alpha);
  for(let x=first(cfg.offsetX);x<=1024;x+=size)g.moveTo(x,0).lineTo(x,1024);
  for(let y=first(cfg.offsetY);y<=1024;y+=size)g.moveTo(0,y).lineTo(1024,y);
  // Keep the grid above game objects, below the selected-element outline.
  if(r.selection){r.app.stage.setChildIndex(g,r.app.stage.children.length-1);r.app.stage.setChildIndex(r.selection,r.app.stage.children.length-1);}
 }
}
