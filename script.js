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
}

function escapeDrawtext(str){
  // FFmpeg drawtext needs escaping for : \ ' and newlines
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
}

function sortCuts(){
  cuts = Array.from(new Set(cuts.map(x => Number(x))))
    .filter(x => x > inPoint + 0.001 && x < outPoint - 0.001)
    .sort((a,b)=>a-b);
}

function computeSegments(){
  // Returns segments from in/out plus cuts: [{start,end}]
  sortCuts();
  const pts = [inPoint, ...cuts, outPoint];
  const segs = [];
  for (let i=0; i<pts.length-1; i++){
    const a = pts[i], b = pts[i+1];
    if (b - a > 0.02) segs.push({start:a, end:b});
  }
  return segs;
}

function setPlayhead(sec){
  sec = clamp(sec, 0, videoDuration || 0);
  preview.currentTime = sec;
  updatePlayheadUI(sec);
}

function updatePlayheadUI(sec){
  if (!videoDuration) return;
  const pct = (sec / videoDuration) * 100;
  playheadEl.style.left = `${pct}%`;
  timeLabel.textContent = fmtTime(sec);
}

function updateSelectionUI(){
  if (!videoDuration) return;
  const leftPct = (inPoint / videoDuration) * 100;
  const widthPct = ((outPoint - inPoint) / videoDuration) * 100;
  selectionEl.style.left = `${leftPct}%`;
  selectionEl.style.width = `${widthPct}%`;
}

function timelineXToTime(clientX){
  const rect = timeline.getBoundingClientRect();
  const x = clamp(clientX - rect.left, 0, rect.width);
  const t = (x / rect.width) * videoDuration;
  return t;
}

/* VIDEO LOAD */
videoInput.onchange = () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  videoFile = file;
  preview.src = URL.createObjectURL(file);
  preview.load();
  setStatus("Vídeo cargado. Esperando metadata...");

  preview.onloadedmetadata = () => {
    videoDuration = preview.duration || 0;
    inPoint = 0;
    outPoint = videoDuration;
    cuts = [];
    updateSelectionUI();
    updatePlayheadUI(0);
    renderCuts();
    renderTexts();
    renderSubtitles();
    renderAudioList();
    setStatus(`Duración: ${fmtTime(videoDuration)}. Listo.`);
  };
};

/* Speed + transition preview behavior */
transitionSelect.onchange = () => {
  bouncePreview = transitionSelect.value === "bounce";
};
preview.addEventListener("play", () => {
  if (bouncePreview) preview.classList.add("bounce");
});
preview.addEventListener("pause", () => {
  preview.classList.remove("bounce");
});
preview.addEventListener("timeupdate", () => {
  updatePlayheadUI(preview.currentTime);
  updateActiveSubtitles(preview.currentTime);
});

/* Timeline dragging: IN/OUT handles */
function makeHandleDraggable(handle, which){
  handle.addEventListener("mousedown", (e) => {
    if (!videoDuration) return;
    e.preventDefault();
    e.stopPropagation();

    const move = (ev) => {
      const t = timelineXToTime(ev.clientX);
      if (which === "left"){
        inPoint = clamp(t, 0, outPoint - 0.05);
      } else {
        outPoint = clamp(t, inPoint + 0.05, videoDuration);
      }
      sortCuts();
      updateSelectionUI();
      renderCuts();
      // clamp currentTime inside selection optionally
      if (preview.currentTime < inPoint) setPlayhead(inPoint);
      if (preview.currentTime > outPoint) setPlayhead(outPoint);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
}
makeHandleDraggable(leftHandle, "left");
makeHandleDraggable(rightHandle, "right");

/* Playhead dragging */
playheadEl.addEventListener("mousedown", (e) => {
  if (!videoDuration) return;
  e.preventDefault();

  const move = (ev) => {
    const t = timelineXToTime(ev.clientX);
    setPlayhead(t);
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
});

/* Clicking timeline sets playhead */
timeline.addEventListener("mousedown", (e) => {
  if (!videoDuration) return;
  // ignore if click on handles
  if (e.target.classList.contains("handle")) return;
  const t = timelineXToTime(e.clientX);
  setPlayhead(t);
});

/* Cuts */
addCutBtn.onclick = () => {
  if (!videoDuration) return;
  const t = preview.currentTime;
  if (t <= inPoint + 0.001 || t >= outPoint - 0.001) return;
  cuts.push(Number(t.toFixed(3)));
  sortCuts();
  renderCuts();
};

clearCutsBtn.onclick = () => {
  cuts = [];
  renderCuts();
};

function renderCuts(){
  cutsListEl.innerHTML = "";
  sortCuts();

  cuts.forEach((c) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.className = "meta";
    left.innerHTML = `<strong>Corte</strong><span>${fmtTime(c)}</span>`;

    const right = document.createElement("div");
    const btn = document.createElement("button");
    btn.className = "danger";
    btn.textContent = "Eliminar";
    btn.onclick = () => {
      cuts = cuts.filter(x => x !== c);
      renderCuts();
    };
    right.appendChild(btn);

    li.appendChild(left);
    li.appendChild(right);
    cutsListEl.appendChild(li);
  });
}

/* TEXT OVERLAYS */
addTextBtn.onclick = () => {
  if (!videoDuration) return;
  const val = textInput.value.trim();
  if (!val) return;

  const now = preview.currentTime;
  const obj = {
    id: crypto.randomUUID(),
    text: val,
    x: 0.5,
    y: 0.5,
    size: 36,
    color: "#ffffff",
    in: clamp(now, 0, videoDuration),
    out: clamp(now + 2.5, 0, videoDuration)
  };

  texts.push(obj);
  selectText(obj.id);
  renderTexts();
};

deleteTextBtn.onclick = () => {
  if (!selectedTextId) return;
  texts = texts.filter(t => t.id !== selectedTextId);
  selectedTextId = null;
  renderTexts();
  clearTextControls();
};

function renderTexts() {
  textLayer.innerHTML = "";

  const now = preview.currentTime;
  texts.forEach(t => {
    // show only if active
    const active = now >= (t.in ?? 0) && now <= (t.out ?? videoDuration);
    if (!active) return;

    const el = document.createElement("div");
    el.className = "text-item" + (t.id === selectedTextId ? " selected" : "");
    el.innerText = t.text;
    el.style.left = (t.x * 100) + "%";
    el.style.top = (t.y * 100) + "%";
    el.style.fontSize = t.size + "px";
    el.style.color = t.color;
    el.dataset.id = t.id;

    makeDraggable(el);
    el.onclick = (e) => {
      e.stopPropagation();
      selectText(t.id);
    };

    textLayer.appendChild(el);
  });
}

function selectText(id) {
  selectedTextId = id;
  const t = texts.find(x => x.id === id);
  if (!t) return;

  textInput.value = t.text;
  textSizeInput.value = t.size;
  textColorInput.value = t.color;
  textInInput.value = (t.in ?? 0).toFixed(2);
  textOutInput.value = (t.out ?? videoDuration).toFixed(2);
  renderTexts();
}

function clearTextControls() {
  textInput.value = "";
  textSizeInput.value = 36;
  textColorInput.value = "#ffffff";
  textInInput.value = "0.00";
  textOutInput.value = (videoDuration || 0).toFixed(2);
}

textInput.oninput = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.text = textInput.value;
  renderTexts();
};

textSizeInput.oninput = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.size = Number(textSizeInput.value);
  renderTexts();
};

textColorInput.oninput = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.color = textColorInput.value;
  renderTexts();
};

textInInput.oninput = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.in = clamp(parseNumber(textInInput.value, 0), 0, videoDuration);
  if (t.out < t.in) t.out = t.in + 0.01;
  textOutInput.value = t.out.toFixed(2);
  renderTexts();
};

textOutInput.oninput = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.out = clamp(parseNumber(textOutInput.value, videoDuration), 0, videoDuration);
  if (t.out < t.in) t.in = Math.max(0, t.out - 0.01);
  textInInput.value = t.in.toFixed(2);
  renderTexts();
};

setTextInBtn.onclick = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.in = clamp(preview.currentTime, 0, videoDuration);
  if (t.out < t.in) t.out = t.in + 0.01;
  textInInput.value = t.in.toFixed(2);
  textOutInput.value = t.out.toFixed(2);
  renderTexts();
};

setTextOutBtn.onclick = () => {
  const t = texts.find(x => x.id === selectedTextId);
  if (!t) return;
  t.out = clamp(preview.currentTime, 0, videoDuration);
  if (t.out < t.in) t.in = Math.max(0, t.out - 0.01);
  textInInput.value = t.in.toFixed(2);
  textOutInput.value = t.out.toFixed(2);
  renderTexts();
};

/* Drag text */
function makeDraggable(el) {
  let startX, startY, startLeft, startTop;

  el.onmousedown = (e) => {
    e.preventDefault();
    const rect = textLayer.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = el.offsetLeft;
    startTop = el.offsetTop;

    const move = (ev) => {
      let x = startLeft + (ev.clientX - startX);
      let y = startTop + (ev.clientY - startY);
      x = clamp(x, 0, rect.width);
      y = clamp(y, 0, rect.height);
      el.style.left = x + "px";
      el.style.top = y + "px";
    };

    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);

      const t = texts.find(x => x.id === el.dataset.id);
      if (t) {
        t.x = el.offsetLeft / rect.width;
        t.y = el.offsetTop / rect.height;
      }
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
}

/* SUBTITLES (manual) */
function renderSubtitles(){
  // dropdown
  subtitleSelect.innerHTML = "";
  subtitles
    .slice()
    .sort((a,b)=>a.start-b.start)
    .forEach((s, idx) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${idx+1}. ${fmtTime(s.start)} → ${fmtTime(s.end)}`;
      subtitleSelect.appendChild(opt);
    });

  // list
  subtitlesListEl.innerHTML = "";
  subtitles
    .slice()
    .sort((a,b)=>a.start-b.start)
    .forEach((s, idx) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.className = "meta";
      left.innerHTML = `<strong>${idx+1}. ${s.text || "(vacío)"}</strong><span>${fmtTime(s.start)} → ${fmtTime(s.end)}</span>`;
      left.style.cursor = "pointer";
      left.onclick = () => selectSubtitle(s.id);

      const right = document.createElement("div");
      const btn = document.createElement("button");
      btn.className = "danger";
      btn.textContent = "Eliminar";
      btn.onclick = () => {
        subtitles = subtitles.filter(x => x.id !== s.id);
        if (selectedSubtitleId === s.id) selectedSubtitleId = null;
        renderSubtitles();
        updateActiveSubtitles(preview.currentTime);
      };
      right.appendChild(btn);

      li.appendChild(left);
      li.appendChild(right);
      subtitlesListEl.appendChild(li);
    });

  // reselect current
  if (selectedSubtitleId && subtitles.some(s=>s.id===selectedSubtitleId)){
    subtitleSelect.value = selectedSubtitleId;
  }
}

function selectSubtitle(id){
  selectedSubtitleId = id;
  const s = subtitles.find(x => x.id === id);
  if (!s) return;
  subtitleSelect.value = id;
  subStartInput.value = s.start.toFixed(2);
  subEndInput.value = s.end.toFixed(2);
  subTextInput.value = s.text || "";
  updateActiveSubtitles(preview.currentTime);
}

function clearSubtitleControls(){
  subStartInput.value = "0.00";
  subEndInput.value = "0.00";
  subTextInput.value = "";
}

addSubtitleBtn.onclick = () => {
  if (!videoDuration) return;
  const now = preview.currentTime;
  const line = {
    id: crypto.randomUUID(),
    start: clamp(now, 0, videoDuration),
    end: clamp(now + 2.0, 0, videoDuration),
    text: "Nuevo subtítulo"
  };
  if (line.end <= line.start) line.end = clamp(line.start + 0.5, 0, videoDuration);
  subtitles.push(line);
  selectSubtitle(line.id);
  renderSubtitles();
};

clearSubtitlesBtn.onclick = () => {
  subtitles = [];
  selectedSubtitleId = null;
  renderSubtitles();
  clearSubtitleControls();
  updateActiveSubtitles(preview.currentTime);
};

subtitleSelect.onchange = () => {
  const id = subtitleSelect.value;
  if (!id) return;
  selectSubtitle(id);
};

subStartInput.oninput = () => {
  const s = subtitles.find(x => x.id === selectedSubtitleId);
  if (!s) return;
  s.start = clamp(parseNumber(subStartInput.value, 0), 0, videoDuration);
  if (s.end < s.start) s.end = s.start + 0.01;
  subEndInput.value = s.end.toFixed(2);
  renderSubtitles();
  updateActiveSubtitles(preview.currentTime);
};

subEndInput.oninput = () => {
  const s = subtitles.find(x => x.id === selectedSubtitleId);
  if (!s) return;
  s.end = clamp(parseNumber(subEndInput.value, 0), 0, videoDuration);
  if (s.end < s.start) s.start = Math.max(0, s.end - 0.01);
  subStartInput.value = s.start.toFixed(2);
  renderSubtitles();
  updateActiveSubtitles(preview.currentTime);
};

subTextInput.oninput = () => {
  const s = subtitles.find(x => x.id === selectedSubtitleId);
  if (!s) return;
  s.text = subTextInput.value;
  renderSubtitles();
  updateActiveSubtitles(preview.currentTime);
};

setSubStartBtn.onclick = () => {
  const s = subtitles.find(x => x.id === selectedSubtitleId);
  if (!s) return;
  s.start = clamp(preview.currentTime, 0, videoDuration);
  if (s.end < s.start) s.end = s.start + 0.01;
  subStartInput.value = s.start.toFixed(2);
  subEndInput.value = s.end.toFixed(2);
  renderSubtitles();
  updateActiveSubtitles(preview.currentTime);
};

setSubEndBtn.onclick = () => {
  const s = subtitles.find(x => x.id === selectedSubtitleId);
  if (!s) return;
  s.end = clamp(preview.currentTime, 0, videoDuration);
  if (s.end < s.start) s.start = Math.max(0, s.end - 0.01);
  subStartInput.value = s.start.toFixed(2);
  subEndInput.value = s.end.toFixed(2);
  renderSubtitles();
  updateActiveSubtitles(preview.currentTime);
};

deleteSubtitleBtn.onclick = () => {
  if (!selectedSubtitleId) return;
  subtitles = subtitles.filter(x => x.id !== selectedSubtitleId);
  selectedSubtitleId = null;
  renderSubtitles();
  clearSubtitleControls();
  updateActiveSubtitles(preview.currentTime);
};

function updateActiveSubtitles(now){
  // update subtitle overlay + text overlay (re-render texts because of timing)
  renderTexts();

  const active = subtitles
    .filter(s => now >= s.start && now <= s.end)
    .sort((a,b)=>a.start-b.start);

  subtitleLayer.innerHTML = "";
  if (active.length){
    const box = document.createElement("div");
    box.className = "subtitle-box";
    box.textContent = active[0].text || "";
    subtitleLayer.appendChild(box);
  }
}

/* SRT Import/Export */
srtInput.onchange = async () => {
  const file = srtInput.files?.[0];
  if (!file) return;
  const txt = await file.text();
  const parsed = parseSRT(txt);
  subtitles = parsed.map(x => ({
    id: crypto.randomUUID(),
    start: x.start,
    end: x.end,
    text: x.text
  }));
  selectedSubtitleId = subtitles[0]?.id ?? null;
  renderSubtitles();
  if (selectedSubtitleId) selectSubtitle(selectedSubtitleId);
  updateActiveSubtitles(preview.currentTime);
};

exportSrtBtn.onclick = () => {
  const srt = toSRT(subtitles);
  const blob = new Blob([srt], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "subtitulos.srt";
  a.click();
  URL.revokeObjectURL(a.href);
};

function parseSRT(srtText){
  // basic SRT parser
  const blocks = srtText.replace(/\r/g,"").trim().split("\n\n");
  const out = [];
  for (const b of blocks){
    const lines = b.split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    // line 0 can be index; line1 is time
    const timeLine = lines[1].includes("-->") ? lines[1] : lines[0];
    const textLines = lines[1].includes("-->") ? lines.slice(2) : lines.slice(2);

    const m = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (!m) continue;
    const start = srtTimeToSeconds(m[1]);
    const end = srtTimeToSeconds(m[2]);
    const text = textLines.join("\n").trim();
    out.push({start, end, text});
  }
  return out;
}

function toSRT(lines){
  const sorted = lines.slice().sort((a,b)=>a.start-b.start);
  return sorted.map((l, idx) => {
    const start = secondsToSrtTime(l.start);
    const end = secondsToSrtTime(l.end);
    const text = (l.text ?? "").trim();
    return `${idx+1}\n${start} --> ${end}\n${text}\n`;
  }).join("\n");
}

function srtTimeToSeconds(t){
  const parts = t.replace(",",".").split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = Number(parts[2]);
  return hh*3600 + mm*60 + ss;
}
function secondsToSrtTime(sec){
  sec = Math.max(0, sec);
  const hh = Math.floor(sec/3600);
  const mm = Math.floor((sec - hh*3600)/60);
  const ss = sec - hh*3600 - mm*60;
  const ssi = Math.floor(ss);
  const ms = Math.floor((ss - ssi)*1000);
  const H = String(hh).padStart(2,"0");
  const M = String(mm).padStart(2,"0");
  const S = String(ssi).padStart(2,"0");
  const MS = String(ms).padStart(3,"0");
  return `${H}:${M}:${S},${MS}`;
}

/* AUDIO SEGMENTS */
let pendingAudioFile = null;

audioClipInput.onchange = () => {
  pendingAudioFile = audioClipInput.files?.[0] ?? null;
};

addAudioClipBtn.onclick = async () => {
  if (!videoDuration) return;
  if (!pendingAudioFile){
    setStatus("Selecciona un archivo de audio para añadir.");
    return;
  }

  const now = preview.currentTime;
  const clip = {
    id: crypto.randomUUID(),
    name: pendingAudioFile.name,
    file: pendingAudioFile,
    start: clamp(now, 0, videoDuration),
    end: clamp(now + 5.0, 0, videoDuration),
    vol: 1.0
  };
  if (clip.end <= clip.start) clip.end = clamp(clip.start + 0.5, 0, videoDuration);

  audioClips.push(clip);
  pendingAudioFile = null;
  audioClipInput.value = "";
  selectAudioClip(clip.id);
  renderAudioList();
};

clearAudioBtn.onclick = () => {
  audioClips = [];
  selectedAudioId = null;
  pendingAudioFile = null;
  audioClipInput.value = "";
  renderAudioList();
  clearAudioControls();
};

function renderAudioList(){
  audioClipSelect.innerHTML = "";
  audioListEl.innerHTML = "";

  audioClips
    .slice()
    .sort((a,b)=>a.start-b.start)
    .forEach((c, idx) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${idx+1}. ${c.name}`;
      audioClipSelect.appendChild(opt);

      const li = document.createElement("li");
      const left = document.createElement("div");
      left.className = "meta";
      left.innerHTML = `<strong>${c.name}</strong><span>${fmtTime(c.start)} → ${fmtTime(c.end)} | vol ${c.vol.toFixed(2)}</span>`;
      left.style.cursor = "pointer";
      left.onclick = () => selectAudioClip(c.id);

      const right = document.createElement("div");
      const btn = document.createElement("button");
      btn.className = "danger";
      btn.textContent = "Eliminar";
      btn.onclick = () => {
        audioClips = audioClips.filter(x => x.id !== c.id);
        if (selectedAudioId === c.id) selectedAudioId = null;
        renderAudioList();
        if (audioClips.length) selectAudioClip(audioClips[0].id);
        else clearAudioControls();
      };
      right.appendChild(btn);

      li.appendChild(left);
      li.appendChild(right);
      audioListEl.appendChild(li);
    });

  if (selectedAudioId && audioClips.some(x=>x.id===selectedAudioId)){
    audioClipSelect.value = selectedAudioId;
  } else if (audioClips.length){
    selectAudioClip(audioClips[0].id);
  } else {
    clearAudioControls();
  }
}

function selectAudioClip(id){
  selectedAudioId = id;
  audioClipSelect.value = id;
  const c = audioClips.find(x => x.id === id);
  if (!c) return;
  audioStartInput.value = c.start.toFixed(2);
  audioEndInput.value = c.end.toFixed(2);
  audioVolInput.value = c.vol.toFixed(2);
  audioVolLabel.textContent = `Volumen: ${c.vol.toFixed(2)}`;
}

function clearAudioControls(){
  audioStartInput.value = "0.00";
  audioEndInput.value = "0.00";
  audioVolInput.value = "1.00";
  audioVolLabel.textContent = "Volumen: 1.00";
}

audioClipSelect.onchange = () => {
  const id = audioClipSelect.value;
  if (!id) return;
  selectAudioClip(id);
};

audioStartInput.oninput = () => {
  const c = audioClips.find(x => x.id === selectedAudioId);
  if (!c) return;
  c.start = clamp(parseNumber(audioStartInput.value, 0), 0, videoDuration);
  if (c.end < c.start) c.end = c.start + 0.01;
  audioEndInput.value = c.end.toFixed(2);
  renderAudioList();
};

audioEndInput.oninput = () => {
  const c = audioClips.find(x => x.id === selectedAudioId);
  if (!c) return;
  c.end = clamp(parseNumber(audioEndInput.value, 0), 0, videoDuration);
  if (c.end < c.start) c.start = Math.max(0, c.end - 0.01);
  audioStartInput.value = c.start.toFixed(2);
  renderAudioList();
};

audioVolInput.oninput = () => {
  const c = audioClips.find(x => x.id === selectedAudioId);
  if (!c) return;
  c.vol = clamp(parseNumber(audioVolInput.value, 1), 0, 2);
  audioVolLabel.textContent = `Volumen: ${c.vol.toFixed(2)}`;
  renderAudioList();
};

setAudioStartBtn.onclick = () => {
  const c = audioClips.find(x => x.id === selectedAudioId);
  if (!c) return;
  c.start = clamp(preview.currentTime, 0, videoDuration);
  if (c.end < c.start) c.end = c.start + 0.01;
  audioStartInput.value = c.start.toFixed(2);
  audioEndInput.value = c.end.toFixed(2);
  renderAudioList();
};

setAudioEndBtn.onclick = () => {
  const c = audioClips.find(x => x.id === selectedAudioId);
  if (!c) return;
  c.end = clamp(preview.currentTime, 0, videoDuration);
  if (c.end < c.start) c.start = Math.max(0, c.end - 0.01);
  audioStartInput.value = c.start.toFixed(2);
  audioEndInput.value = c.end.toFixed(2);
  renderAudioList();
};

deleteAudioClipBtn.onclick = () => {
  if (!selectedAudioId) return;
  audioClips = audioClips.filter(x => x.id !== selectedAudioId);
  selectedAudioId = null;
  renderAudioList();
};

/* SAVE / LOAD PROJECT */
saveProjectBtn.onclick = () => {
  if (!videoDuration) return;

  const project = {
    projectVersion: "1.2",
    settings: {
      speed: speedSelect.value,
      transition: transitionSelect.value,
      preset: presetSelect.value
    },
    timeline: {
      inPoint,
      outPoint,
      cuts
    },
    texts,
    subtitles,
    audioClips: audioClips.map(c => ({
      id: c.id,
      name: c.name,
      start: c.start,
      end: c.end,
      vol: c.vol
      // file is not saved in JSON (browser limitation)
    }))
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mini-reels-project.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Proyecto guardado (nota: los archivos de audio no se incluyen en el JSON).");
};

loadProjectInput.onchange = async () => {
  const file = loadProjectInput.files?.[0];
  if (!file) return;
  const txt = await file.text();
  let obj;
  try{
    obj = JSON.parse(txt);
  } catch {
    setStatus("JSON inválido.");
    return;
  }

  // Apply safe defaults for backwards compatibility
  const t = obj.timeline || {};
  inPoint = clamp(Number(t.inPoint ?? 0), 0, videoDuration || 0);
  outPoint = clamp(Number(t.outPoint ?? (videoDuration||0)), 0, videoDuration || 0);
  if (outPoint <= inPoint) { inPoint = 0; outPoint = videoDuration || 0; }

  cuts = Array.isArray(t.cuts) ? t.cuts.map(Number) : [];
  sortCuts();

  const s = obj.settings || {};
  if (s.speed) speedSelect.value = String(s.speed);
  if (s.transition) transitionSelect.value = String(s.transition);
  if (s.preset) presetSelect.value = String(s.preset);

  texts = Array.isArray(obj.texts) ? obj.texts.map(x => ({
    id: x.id ?? crypto.randomUUID(),
    text: x.text ?? "",
    x: Number(x.x ?? 0.5),
    y: Number(x.y ?? 0.5),
    size: Number(x.size ?? 36),
    color: x.color ?? "#ffffff",
    in: Number(x.in ?? 0),
    out: Number(x.out ?? (videoDuration||0))
  })) : [];

  subtitles = Array.isArray(obj.subtitles) ? obj.subtitles.map(x => ({
    id: x.id ?? crypto.randomUUID(),
    start: Number(x.start ?? 0),
    end: Number(x.end ?? 0),
    text: x.text ?? ""
  })) : [];

  // audio clips metadata only (files must be re-added by user)
  audioClips = Array.isArray(obj.audioClips) ? obj.audioClips.map(x => ({
    id: x.id ?? crypto.randomUUID(),
    name: x.name ?? "audio",
    file: null, // must reattach
    start: Number(x.start ?? 0),
    end: Number(x.end ?? 0),
    vol: Number(x.vol ?? 1)
  })) : [];

  updateSelectionUI();
  renderCuts();
  renderTexts();
  renderSubtitles();
  renderAudioList();
  updateActiveSubtitles(preview.currentTime);

  setStatus("Proyecto cargado. Importante: vuelve a seleccionar los archivos de audio (no viajan en el JSON).");
};

/* EXPORT */
processBtn.onclick = async () => {
  if (!videoFile || !videoDuration){
    setStatus("Carga un vídeo primero.");
    return;
  }

  try{
    setStatus("Inicializando FFmpeg...");
    processBtn.disabled = true;

    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: true });
    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    // Write input video
    const inName = "input.mp4";
    ffmpeg.FS("writeFile", inName, await fetchFile(videoFile));

    // Load font (DejaVuSans)
    // Using a stable raw file URL; if it fails, drawtext may fail depending on build.
    const fontUrl = "https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/master/ttf/DejaVuSans.ttf";
    try{
      const fontData = await fetch(fontUrl).then(r => r.arrayBuffer());
      ffmpeg.FS("writeFile", "DejaVuSans.ttf", new Uint8Array(fontData));
    } catch {
      // continue; some builds have fallback fonts, but drawtext may still fail.
      setStatus("Aviso: no se pudo descargar la fuente. Si falla drawtext, prueba con otra URL de fuente.");
    }

    const segs = computeSegments();
    if (!segs.length){
      setStatus("No hay segmentos válidos para exportar.");
      processBtn.disabled = false;
      return;
    }

    const speed = Number(speedSelect.value || "1");
    const transition = transitionSelect.value || "none";
    const preset = presetSelect.value || "instagram";

    // Presets (simple, stable)
    const presetArgs = getPresetArgs(preset);

    // 1) Create per-segment clips (trim)
    setStatus("Generando segmentos...");
    const segmentFiles = [];
    for (let i=0; i<segs.length; i++){
      const s = segs[i];
      const outSeg = `seg_${i}.mp4`;

      // Trim with re-encode (stable with wasm); apply speed at this stage (video+audio)
      // atempo supports 0.5..2.0; for >2 we'd chain, but your UI max is 2
      const vfSpeed = speed !== 1 ? `setpts=(PTS-STARTPTS)/${speed}` : `setpts=PTS-STARTPTS`;
      const afSpeed = speed !== 1 ? `atempo=${speed}` : `anull`;

      await ffmpeg.run(
        "-i", inName,
        "-ss", String(s.start),
        "-to", String(s.end),
        "-vf", vfSpeed,
        "-af", afSpeed,
        "-preset", "veryfast",
        "-movflags", "+faststart",
        outSeg
      );

      segmentFiles.push(outSeg);
    }

    // 2) Concat segments + transitions (fade/flash using xfade if multiple)
    setStatus("Concatenando...");
    const concatOut = "concat.mp4";

    if (segmentFiles.length === 1){
      // Just rename by re-muxing
      await ffmpeg.run("-i", segmentFiles[0], "-c", "copy", concatOut);
    } else {
      // Use filter_complex concat for reliability
      // We will concatenate without transitions first, then optionally apply a global effect is complex.
      // Simple approach: concat demuxer (no re-encode), but segments are re-encoded equally; still safe.
      const listTxt = segmentFiles.map(f => `file '${f}'`).join("\n");
      ffmpeg.FS("writeFile", "list.txt", new TextEncoder().encode(listTxt));
      await ffmpeg.run(
        "-f","concat","-safe","0",
        "-i","list.txt",
        "-c","copy",
        concatOut
      );

      // Optional: apply quick transitions by re-encoding (lightweight): fade/flash at cuts
      if (transition !== "none"){
        setStatus("Aplicando transición...");
        const transOut = "concat_trans.mp4";

        // Build fade at cut boundaries (approx). We use the cut times mapped to concatenated timeline.
        // Map segment durations post-speed
        const segDurations = segs.map(s => (s.end - s.start) / speed);
        const cutTimes = [];
        let acc = 0;
        for (let i=0; i<segDurations.length-1; i++){
          acc += segDurations[i];
          cutTimes.push(acc);
        }
        const d = 0.2; // transition duration
        // Build vf with multiple fades (fade out then in). Flash uses eq to bump brightness briefly.
        let vf = "format=yuv420p";
        cutTimes.forEach((ct, idx) => {
          const stOut = Math.max(0, ct - d);
          if (transition === "fade"){
            vf += `,fade=t=out:st=${stOut}:d=${d},fade=t=in:st=${ct}:d=${d}`;
          } else if (transition === "flash"){
            // quick "flash" by fade to white-ish using eq gamma/contrast boost
            vf += `,eq=contrast=1.2:brightness=0.06:enable='between(t,${stOut},${ct})'`;
          }
        });

        await ffmpeg.run(
          "-i", concatOut,
          "-vf", vf,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "22",
          "-c:a", "aac",
          "-b:a", "128k",
          transOut
        );

        // replace concatOut reference
        ffmpeg.FS("unlink", concatOut);
        await ffmpeg.run("-i", transOut, "-c", "copy", concatOut);
      }
    }

    // 3) Overlay texts + subtitles with drawtext + scale/crop to preset
    setStatus("Aplicando overlays (texto/subtítulos)...");
    const overlayOut = "overlay.mp4";

    const { width, height, vfPreset } = presetArgs;

    // Build drawtext filters with enable between(t,start,end)
    // Important: times are now in the concatenated timeline (post-speed and post-cut concat).
    const timelineMap = buildConcatTimeMap(segs, speed); // maps original times to concat time
    const drawFilters = [];

    // scale/crop for vertical reels if needed
    if (vfPreset) drawFilters.push(vfPreset);

    // texts
    for (const t of texts){
      const start = mapToConcatTime(t.in ?? 0, timelineMap);
      const end = mapToConcatTime(t.out ?? 0, timelineMap);
      if (end <= start) continue;

      const x = Math.round((t.x ?? 0.5) * width);
      const y = Math.round((t.y ?? 0.5) * height);
      const size = Math.round(t.size ?? 36);
      const color = (t.color ?? "#ffffff").replace("#","0x");

      drawFilters.push(
        `drawtext=fontfile=DejaVuSans.ttf:text='${escapeDrawtext(t.text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:shadowcolor=black:shadowx=2:shadowy=2:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`
      );
    }

    // subtitles: bottom-centered box-like styling via drawtext (simple)
    for (const s of subtitles){
      const start = mapToConcatTime(s.start, timelineMap);
      const end = mapToConcatTime(s.end, timelineMap);
      if (end <= start) continue;

      // centered bottom
      const fontSize = Math.round(height * 0.045); // responsive
      // Use boxed text by drawing semi-transparent box
      drawFilters.push(
        `drawtext=fontfile=DejaVuSans.ttf:text='${escapeDrawtext(s.text)}':x=(w-text_w)/2:y=h-(text_h*2.6):fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:shadowcolor=black:shadowx=2:shadowy=2:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`
      );
    }

    const vf = drawFilters.length ? drawFilters.join(",") : (vfPreset || "format=yuv420p");

    await ffmpeg.run(
      "-i", concatOut,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "128k",
      overlayOut
    );

    // 4) Mix audio segments into final
    // Audio in overlayOut includes original video audio (already sped) from concat stage.
    // Now we add each clip: trim desired portion from audio file (0..clipDur), then delay to clip.start, volume, mix.
    const finalOut = "final.mp4";

    const clipsWithFile = audioClips.filter(c => c.file instanceof File && (c.end - c.start) > 0.02);
    if (!clipsWithFile.length){
      setStatus("Export final (sin audio extra)...");
      await ffmpeg.run(
        ...presetArgs.extraArgs,
        "-i", overlayOut,
        "-c", "copy",
        finalOut
      );
    } else {
      setStatus("Mezclando audio por tramos...");

      // write audio files
      for (let i=0; i<clipsWithFile.length; i++){
        const c = clipsWithFile[i];
        const name = `aud_${i}${guessExt(c.file.name)}`;
        c._fsName = name;
        ffmpeg.FS("writeFile", name, await fetchFile(c.file));
      }

      // Inputs: [0]=overlayOut (base), [1..]=aud_i
      const args = [];
      args.push("-i", overlayOut);
      clipsWithFile.forEach(c => args.push("-i", c._fsName));

      // filter_complex:
      // base audio: [0:a] asetpts=PTS-STARTPTS [abase]
      // each clip: [i:a] atrim=0:dur, asetpts=PTS-STARTPTS, volume, adelay=startMs|startMs [ai]
      // mix: amix=inputs=N:normalize=0
      const fc = [];
      fc.push("[0:a]asetpts=PTS-STARTPTS[abase]");

      const mixInputs = ["[abase]"];
      clipsWithFile.forEach((c, idx) => {
        const inputIndex = idx + 1;
        const dur = (c.end - c.start) / speed; // concat timeline already speed-applied, so keep same
        const startInConcat = mapToConcatTime(c.start, timelineMap);
        const delayMs = Math.max(0, Math.round(startInConcat * 1000));
        const vol = clamp(Number(c.vol ?? 1), 0, 2);

        fc.push(
          `[${inputIndex}:a]atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)},adelay=${delayMs}|${delayMs}[a${idx}]`
        );
        mixInputs.push(`[a${idx}]`);
      });

      fc.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:normalize=0[aout]`);

      args.push(
        "-filter_complex", fc.join(";"),
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        finalOut
      );

      await ffmpeg.run(...args);
    }

    // Read output and download
    setStatus("Preparando descarga...");
    const data = ffmpeg.FS("readFile", finalOut);
    const blob = new Blob([data.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "mini-reels-export.mp4";
    a.click();

    URL.revokeObjectURL(url);
    setStatus("Exportación completada.");

  } catch (err){
    console.error(err);
    setStatus("Error en exportación. Revisa la consola (F12).");
  } finally {
    processBtn.disabled = false;
  }
};

function guessExt(name){
  const m = name.toLowerCase().match(/\.(mp3|wav|m4a|aac|ogg)$/);
  return m ? `.${m[1]}` : ".mp3";
}

/* Preset helpers */
function getPresetArgs(preset){
  // We implement vertical output via scale+crop into 1080x1920 for instagram
  if (preset === "instagram"){
    return {
      width: 1080,
      height: 1920,
      vfPreset: "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      extraArgs: []
    };
  }
  if (preset === "high"){
    return {
      width: 1080,
      height: 1920,
      vfPreset: "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      extraArgs: []
    };
  }
  // light
  return {
    width: 1080,
    height: 1920,
    vfPreset: "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
    extraArgs: []
  };
}

/* Mapping original times to concatenated times */
function buildConcatTimeMap(segs, speed){
  // segs are original slices. After speed, each segment duration is (end-start)/speed.
  // We map any original time -> concatenated time if it falls within selected region.
  // For values outside selection, map clamps to nearest boundary.
  const map = [];
  let acc = 0;
  for (const s of segs){
    const dur = (s.end - s.start) / speed;
    map.push({
      oStart: s.start,
      oEnd: s.end,
      cStart: acc,
      cEnd: acc + dur
    });
    acc += dur;
  }
  map.total = acc;
  return map;
}

function mapToConcatTime(originalTime, map){
  if (!map || !map.length) return 0;
  // find segment containing originalTime
  for (const seg of map){
    if (originalTime >= seg.oStart && originalTime <= seg.oEnd){
      const rel = (originalTime - seg.oStart) / (seg.oEnd - seg.oStart);
      return seg.cStart + rel * (seg.cEnd - seg.cStart);
    }
  }
  // clamp
  if (originalTime < map[0].oStart) return 0;
  return map[map.length-1].cEnd;
}

/* Small bounce animation for preview only */
const style = document.createElement("style");
style.textContent = `
  .bounce { animation: miniBounce 0.35s ease-in-out infinite alternate; }
  @keyframes miniBounce { from { transform: scale(1); } to { transform: scale(1.01); } }
`;
document.head.appendChild(style);
