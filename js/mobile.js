export function mobileProfile(settings,viewport={width:globalThis.innerWidth||1024,touch:(globalThis.navigator?.maxTouchPoints||0)>0}){
 const p=settings.performance;return Boolean(p?.mobileEnabled&&viewport.touch&&viewport.width<=p.mobileBreakpoint);
}
// Logical coordinates stay 1024 × 1024. Only the GPU backing resolution changes.
export function renderProfile(settings,mobile){return{resolution:mobile?settings.performance.mobileResolution:1,textResolution:mobile?Math.min(settings.textRendering.resolution,settings.performance.mobileTextResolution):settings.textRendering.resolution};}
export function mobileMenuConfig(config, settings, mobile) {
 if (!mobile) return config;
 const profile = settings.performance;
 return {...config, w:Math.min(1004, Math.max(config.w, 1024*profile.mobileMenuWidth)),
  fontSize:config.fontSize*profile.mobileMenuScale, subSize:config.subSize*profile.mobileMenuScale};
}
