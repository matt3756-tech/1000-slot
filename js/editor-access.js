// index.html owns this switch, so a saved editor layout cannot override it.
export function editorAccess(value='visible'){
 const mode=['visible','hidden','off'].includes(value)?value:'visible';
 return{mode,enabled:mode!=='off',buttonVisible:mode==='visible'};
}
