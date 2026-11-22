// The shape of these defaults also defines the editor's fields and import schema.
export const FONT = 'Matcha Squishy';
export const SIZE = 1024;
export const BETS = Array.from({ length: 10 }, (_, index) => (index + 1) * 10);
export const START_CREDITS = 1000;

const button = (x, y, w, h, label, fontSize, round = false) => ({
  x, y, w, h, label, fontSize, round, scale: 1, rotation: 0, alpha: 1,
  color: '#ffffff', labelX: 0, labelY: 0, hitPadding: 4,
  pressScale: .95, pressY: 3, pressDuration: 145, pressShade: .17
});
const mask = (x, y, w, h, radius) => ({ x, y, w, h, radius, rotation: 0, show: true });
const hud = (x, label, color) => ({
  x, y: -425, w: 270, label, fontSize: 58, labelSize: 26, labelY: -46,
  color, labelColor: '#a6bccb', scale: 1, rotation: 0, alpha: 1
});
const panel = (w, h) => ({
  x: 512, y: 509, w, h, scale: 1, fontSize: 53, subSize: 32,
  color: '#f0f6ff', fill: '#141a27', fillAlpha: .97, border: '#6fa4b7', borderWidth: 2,
  radius: 29, dim: .62, textureAlpha: .17, inDuration: 200, outDuration: 150
});
const symbol = weight => ({
  weight, size: 151, widthScale: 1, heightScale: 1, offsetX: 0, offsetY: 0,
  rotation: 0, alpha: 1, tint: '#ffffff'
});
const cue = kind => ({ [kind + 'Volume']: 1, [kind + 'TimingMs']: 0, [kind + 'OffsetMs']: 0 });
export const defaults = {
  version: 1,
  slot: { x: 512, y: 512, scale: .96, rotation: 0, alpha: 1 },
  background: { brightness: 1 },
  reels: { x: 98, y: 263, w: 254, h: 494, columnStep: 287, spacing: 163, clipRadius: 15 },
  spin: { speed: 17, duration: 800, stagger: 235, startDuration: 95, stopDuration: 170,
    bounce: 5, bounceDuration: 135, bounceCycles: 1 },
  anticipation: { enabled: true, extraDuration: 1050, rightExtraDuration: 500, stopDuration: 860 },
  anticipationChase: { enabled: true, padding: 6, radius: 17, width: 4, glowWidth: 21, alpha: 1,
    baseAlpha: .23, color: '#61d5ff', coreColor: '#f5fcff', duration: 1280, tailLength: .26, heads: 2 },
  landing: { enabled: true, duration: 620, brightness: .55, haloAlpha: .50, haloBlur: 14,
    haloTint: '#ffd38a', pop: .055, sparkles: true, sparkleCount: 12, sparkleSize: 22,
    sparkleColor: '#fff2ce', sparkleAlpha: .9 },
  winning: { enabled: true, duration: 520, brightness: .52, haloAlpha: .74, haloBlur: 15,
    haloTint: '#83ddff', pop: .18, sparkles: true, sparkleCount: 10, sparkleSize: 24,
    sparkleColor: '#e6faff', sparkleAlpha: .98 },
  symbols: { coin10: symbol(78), coin100: symbol(18), coin1000: symbol(4) },
  buttons: {
    menu: button(-390, 431, 167, 78, 'MENU', 36),
    spin: button(0, 384, 214, 214, 'SPIN', 63, true),
    betMinus: button(215, 431, 167, 78, 'BET -', 36),
    betPlus: button(391, 431, 167, 78, 'BET +', 36)
  },
  masks: {
    menu: mask(-390, 431, 156, 70, 34),
    spin: mask(0, 384, 202, 202, 101),
    betMinus: mask(215, 431, 156, 70, 34),
    betPlus: mask(391, 431, 156, 70, 34)
  },
  hud: { credit: hud(-305, 'CREDITS', '#f4f8ff'), bet: hud(0, 'BET', '#a7edff'),
    win: hud(305, 'LAST WIN', '#ffe1a0') },
  payline: { enabled: true, x: 0, y: 1, spacing: 924, labelSize: 24, subSize: 14, color: '#ffffff', alpha: 1 },
  popups: {
    line: { x: 512, y: 510, w: 780, scale: 1, fontSize: 132, color: '#fff3c7', alpha: 1,
      inDuration: 145, countDuration: 560, holdDuration: 460, outDuration: 175, previewValue: 10000, enabled: true },
    menu: panel(680, 590), pays: panel(815, 650), leaderboard: panel(860, 590),
    cashout: panel(880, 805), volume: panel(730, 550)
  },
  textEffects: { line: {
    strokeEnabled: true, strokeWidth: 3, strokeColor: '#10131e', gradientEnabled: true,
    topColor: '#fffbea', bottomColor: '#ffc05d', letterSpacing: 2, shadowEnabled: true,
    shadowColor: '#000000', shadowAlpha: .7, shadowBlur: 9, shadowDistance: 9, shadowAngle: 73,
    extrusionEnabled: true, depth: 7, depthAngle: 75, depthNearColor: '#995c25', depthFarColor: '#31213a',
    bevelEnabled: false, bevelSize: 1.5, bevelColor: '#fff8d5', bevelAlpha: .8,
    glowEnabled: true, glowColor: '#ffd375', glowAlpha: .42, glowBlur: 15
  } },
  startup: { x: 512, y: 428, w: 510, h: 155, scale: 1, imageAlpha: 1, title: 'COIN 10s',
    titleSize: 104, fontSize: 35, color: '#f4f8ff', loadingY: 681, promptY: 741, fadeDuration: 400 },
  paysLayout: { thumbnailHeight: 63, gap: 12, cardPadding: 8 },
  volumeMenu: { rowGap: 32 },
  leaderboard: { maxRows: 5 },
  cashoutRules: { noDebtMinimum: 10000, borrowedMinimum: 5000, resetDays: 30 },
  audio: { enabled: true, musicEnabled: true, sfxVolume: .78, musicVolume: .28,
    ...cue('click'), ...cue('stop'), ...cue('anticipate'), ...cue('win'), fadeDuration: 350 },
  performance: { nativeRefresh: true, maxFPS: 60, mobileEnabled: true, mobileBreakpoint: 1100,
    mobileResolution: .85, mobileTextResolution: 2, maxVoices: 24, mobileMenuScale: 1.12, mobileMenuWidth: .92 },
  textRendering: { resolution: 2, roundPixels: false },
  editorGrid: { snapEnabled: false, showGrid: false, size: 24, offsetX: 0, offsetY: 0,
    lineWidth: 1, color: '#70ddff', alpha: .28 }
};

const KEY = 'coin10s.settings.v1';
export const clone = value => structuredClone(value);
export const getPath = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const field = keys.pop();
  keys.reduce((entry, key) => entry[key], obj)[field] = value;
}
export function updateLayoutField(settings, path, value) {
  const [group, id, axis] = path.split('.');
  const previous = getPath(settings, path);
  setPath(settings, path, value);
  if (group === 'buttons' && (axis === 'x' || axis === 'y')) settings.masks[id][axis] += value - previous;
}
export const popupKinds = ['line', 'menu', 'pays', 'leaderboard', 'cashout', 'volume', 'startup'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function limits(path, value) {
  const key = path.split('.').at(-1);
  const range = (min, max, step = 1) => ({ min, max, step });
  if (path.startsWith('cashoutRules.')) return key === 'resetDays' ? range(1, 365) : range(1000, 100000, 1000);
  if (key.endsWith('TimingMs')) return range(-1200, 1200, 5);
  if (key.endsWith('OffsetMs')) return range(0, 2500, 5);
  if (key.endsWith('Duration') || key === 'duration') return range(0, 6000, 5);
  if (key.endsWith('Volume')) return range(0, 2, .01);
  if (key.toLowerCase().endsWith('alpha') || /^(dim|baseAlpha|tailLength|pressShade)$/.test(key)) return range(0, 1, .01);
  if (/^(scale|widthScale|heightScale|pressScale)$/.test(key)) return range(.1, 2.5, .01);
  if (/^(rotation|shadowAngle|depthAngle)$/.test(key)) return range(-180, 360);
  if (/^(offsetX|offsetY|labelX|labelY|pressY)$/.test(key)) return range(-300, 300);
  if (/^(x|y)$/.test(key)) return range(-600, 1624);
  if (/^(w|h|spacing|loadingY|promptY)$/.test(key)) return range(30, 1024);
  if (key === 'bevelSize') return range(0, 12, .1);
  if (/fontSize|Size$/.test(key)) return range(6, 260);
  if (key === 'size') return path.startsWith('symbols') ? range(20, 420) : range(5, 128);
  if (key === 'weight') return range(0, 200, .01);
  if (key === 'speed') return range(4, 35, .1);
  if (key === 'stagger') return range(20, 2000, 5);
  if (key === 'bounce') return range(0, 60, .5);
  if (key === 'bounceCycles') return range(1, 4);
  if (key === 'heads') return range(1, 4);
  if (key === 'columnStep') return range(40, 700);
  if (key === 'mobileMenuWidth') return range(.65, .98, .01);
  if (/Radius|radius|Blur|Width|Padding$/.test(key)) return range(0, 140, .5);
  if (/^(padding|gap|rowGap|pop|brightness)$/.test(key)) return /brightness|pop/.test(key) ? range(0, 2, .01) : range(0, 85);
  if (key === 'letterSpacing') return range(-12, 30, .5);
  if (key === 'previewValue') return range(1, 100000000, 1);
  if (key === 'sparkleCount') return range(0, 32);
  if (key === 'maxRows') return range(1, 20);
  if (key === 'mobileBreakpoint') return range(320, 1600, 10);
  if (key === 'mobileMenuScale') return range(.85, 1.5, .01);
  if (key === 'maxVoices') return range(6, 48);
  if (key === 'maxFPS') return range(15, 240);
  if (key.toLowerCase().endsWith('resolution')) return range(.5, 3, .05);
  return range(0, Math.max(100, value * 2), .1);
}
export function mergeSettings(raw, base = defaults) {
  const merge = (template, source, prefix = '') => Object.fromEntries(Object.entries(template).map(([key, value]) => {
    const input = source?.[key], path = prefix + key;
    if (value && typeof value === 'object') return [key, merge(value, input, path + '.')];
    if (typeof value === 'number') {
      const { min, max, step } = limits(path, value);
      const safe = Number.isFinite(input) ? clamp(input, min, max) : value;
      return [key, step === 1 ? Math.round(safe) : safe];
    }
    if (typeof value === 'string' && value.startsWith('#')) return [key, /^#[a-f\d]{6}$/i.test(input) ? input : value];
    return [key, typeof input === typeof value ? (typeof input === 'string' ? input.slice(0, 100) : input) : value];
  }));
  const settings = merge(base, raw?.settings ?? raw);
  if (!Object.values(settings.symbols).some(symbol => symbol.weight > 0)) throw Error('Keep at least one coin weight above zero.');
  return settings;
}
export async function loadSettings() {
  let fileDefaults = defaults;
  try {
    const response = await fetch(new URL('../current-settings.json?v=' + Date.now(), import.meta.url), { cache: 'no-store' });
    if (response.ok) fileDefaults = mergeSettings(await response.json());
  } catch (error) { console.warn('Using bundled defaults.', error); }
  try {
    return { settings: mergeSettings(JSON.parse(localStorage.getItem(KEY)), fileDefaults), fileDefaults };
  } catch {
    return { settings: clone(fileDefaults), fileDefaults };
  }
}
export const saveSettings = settings => localStorage.setItem(KEY, JSON.stringify(mergeSettings(settings)));
