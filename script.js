/* Mini Reels Editor - Full
   - IN/OUT selection draggable
   - Cuts list
   - Text overlays draggable + edit + timing
   - Manual subtitles: add/edit, import/export SRT, preview overlay
   - Audio segments: add multiple clips with start/end/volume, mixed in export
   - Export via ffmpeg.wasm (concat segments + overlay + audio mix)
*/

const preview = document.getElementById("preview");
const videoInput = document.getElementById("videoInput");
const speedSelect = document.getElementById("speed");
const transitionSelect = document.getElementById("transition");
const presetSelect = document.getElementById("preset");
const statusEl = document.getElementById("status");
const timeLabel = document.getElementById("timeLabel");

/* Timeline elements */
const timeline = document.getElementById("timeline");
const selectionEl = document.getElementById("selection");
const leftHandle = selectionEl.querySelector(".handle.left");
const rightHandle = selectionEl.querySelector(".handle.right");
const playheadEl = document.getElementById("playhead");
const addCutBtn = document.getElementById("addCut");
const clearCutsBtn = document.getElementById("clearCuts");
const cutsListEl = document.getElementById("cutsList");

/* Text elements */
const textInput = document.getElementById("textInput");
const textSizeInput = document.getElementById("textSize");
const textColorInput = document.getElementById("textColor");
const textInInput = document.getElementById("textIn");
const textOutInput = document.getElementById("textOut");
const setTextInBtn = document.getElementById("setTextIn");
const setTextOutBtn = document.getElementById("setTextOut");
const addTextBtn = document.getElementById("addTextBtn");
const deleteTextBtn = document.getElementById("deleteTextBtn");
const textLayer = document.getElementById("textLayer");

/* Subtitles */
const srtInput = document.getElementById("srtInput");
const exportSrtBtn = document.getElementById("exportSrt");
const addSubtitleBtn = document.getElementById("addSubtitle");
const clearSubtitlesBtn = document.getElementById("clearSubtitles");
const subtitleSelect = document.getElementById("subtitleSelect");
const setSubStartBtn = document.getElementById("setSubStart");
const setSubEndBtn = document.getElementById("setSubEnd");
const subStartInput = document.getElementById("subStart");
const subEndInput = document.getElementById("subEnd");
const subTextInput = document.getElementById("subText");
const deleteSubtitleBtn = document.getElementById("deleteSubtitle");
const subtitlesListEl = document.getElementById("subtitlesList");
const subtitleLayer = document.getElementById("subtitleLayer");

/* Audio segments */
const audioClipInput = document.getElementById("audioClipInput");
const addAudioClipBtn = document.getElementById("addAudioClipBtn");
const clearAudioBtn = document.getElementById("clearAudioBtn");
const audioClipSelect = document.getElementById("audioClipSelect");
const setAudioStartBtn = document.getElementById("setAudioStart");
const setAudioEndBtn = document.getElementById("setAudioEnd");
const audioStartInput = document.getElementById("audioStart");
const audioEndInput = document.getElementById("audioEnd");
const audioVolInput = document.getElementById("audioVol");
const audioVolLabel = document.getElementById("audioVolLabel");
const deleteAudioClipBtn = document.getElementById("deleteAudioClip");
const audioListEl = document.getElementById("audioList");

/* Save/Load */
const saveProjectBtn = document.getElementById("saveProject");
const loadProjectInput = document.getElementById("loadProject");

/* Export */
const processBtn = document.getElementById("processBtn");

/* State */
let videoFile = null;
let videoDuration = 0;

let inPoint = 0;           // seconds
let outPoint = 0;          // seconds
let cuts = [];             // seconds, within [inPoint,outPoint]

let texts = [];            // {id,text,x,y,size,color,in,out}
let selectedTextId = null;

let subtitles = [];        // {id,start,end,text}
let selectedSubtitleId = null;

let audioClips = [];       // {id,name,file,start,end,vol}
let selectedAudioId = null;

let bouncePreview = false;

/* Utilities */
function setStatus(msg) { statusEl.textContent = msg; }

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function fmtTime(sec){
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const mm = String(m).padStart(2,"0");
  const ss = String(Math.floor(s)).padStart(2,"0");
  const cs = String(Math.floor((s - Math.floor(s)) * 100)).padStart(2,"0");
  return `${mm}:${ss}.${cs}`;
}

function parseNumber(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
