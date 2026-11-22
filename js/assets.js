// Both uploaded editor data URLs and game-folder files use the same loading path.
export function localAssetPath(input){
 const value=String(input).trim().replace(/\\/g,'/').replace(/^\.\//,'');
 if(!value||value.startsWith('/')||/^[a-z][a-z0-9+.-]*:/i.test(value)||value.split('/').includes('..'))throw Error('Use a path inside the game folder, such as assets/custom/MyFont.woff2.');
 return value;
}
export function mediaSource(value){
 if(String(value).startsWith('data:'))return value;
 const path=localAssetPath(value),url=new URL(path,document.baseURI);url.searchParams.set('v',Date.now());return url.href;
}
export function validMediaReference(value){try{return typeof value==='string'&&(value.startsWith('data:')||Boolean(localAssetPath(value)));}catch{return false;}}
export async function localMediaManifest(){
 const response=await fetch(`custom-assets.json?v=${Date.now()}`,{cache:'no-store'});
 if(!response.ok)return{};const data=await response.json();
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.entries(data).some(([key,v])=>! /^(font:|texture:|audio:|video:(?:background|bonusBackground)$)/.test(key)||!validMediaReference(v)))throw Error('Check the paths and asset keys in custom-assets.json.');
 return data;
}
