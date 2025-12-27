const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

const preview = document.getElementById("preview");
const timeline = document.getElementById("timeline");
const selection = document.getElementById("selection");
const leftHandle = document.querySelector(".handle.left");
const rightHandle = document.querySelector(".handle.right");

let duration = 0;
let inPoint = 0;
let outPoint = 0;
let cuts = [];

preview.onloadedmetadata = () => {
  duration = preview.duration;
  inPoint = 0;
  outPoint = duration;
  updateSelection();
};

/* -------- DRAG HANDLES -------- */

function handleDrag(e, isLeft) {
  const rect = timeline.getBoundingClientRect();
  const percent = Math.min(Math.max(0, e.clientX - rect.left), rect.width) / rect.width;
  const time = percent * duration;

  if (isLeft && time < outPoint) inPoint = time;
  if (!isLeft && time > inPoint) outPoint = time;

  updateSelection();
}

[leftHandle, rightHandle].forEach(handle => {
  handle.onmousedown = e => {
    const isLeft = handle.classList.contains("left");
    document.onmousemove = ev => handleDrag(ev, isLeft);
    document.onmouseup = () => document.onmousemove = null;
  };
});

function updateSelection() {
  const start = (inPoint / duration) * 100;
  const width = ((outPoint - inPoint) / duration) * 100;
  selection.style.left = `${start}%`;
  selection.style.width = `${width}%`;
}

/* -------- CUTS -------- */

document.getElementById("addCut").onclick = () => {
  cuts.push([inPoint, outPoint]);
  renderCuts();
};

document.getElementById("clearCuts").onclick = () => {
  cuts = [];
  renderCuts();
};

function renderCuts() {
  const list = document.getElementById("cutsList");
  list.innerHTML = "";
  cuts.forEach((c, i) => {
    const li = document.createElement("li");
    li.textContent = `Corte ${i+1}: ${c[0].toFixed(2)}s → ${c[1].toFixed(2)}s`;
    list.appendChild(li);
  });
}

/* -------- SAVE / LOAD PROJECT -------- */

document.getElementById("saveProject").onclick = () => {
  const project = {
    cuts,
    speed: speed.value,
    transition: transition.value,
    preset: preset.value
  };
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "proyecto.json";
  a.click();
};

document.getElementById("loadProject").onchange = e => {
  const reader = new FileReader();
  reader.onload = () => {
    const p = JSON.parse(reader.result);
    cuts = p.cuts;
    speed.value = p.speed;
    transition.value = p.transition;
    preset.value = p.preset;
    renderCuts();
  };
  reader.readAsText(e.target.files[0]);
};

/* -------- EXPORT PRESETS -------- */

function getPreset(preset) {
  if (preset === "high") return { crf: "16", preset: "slow" };
  if (preset === "light") return { crf: "23", preset: "veryfast" };
  return { crf: "18", preset: "slow" }; // Instagram
}
/* ======================
   TEXT OVERLAYS
====================== */

const textInput = document.getElementById("textInput");
const textSizeInput = document.getElementById("textSize");
const textColorInput = document.getElementById("textColor");
const addTextBtn = document.getElementById("addTextBtn");
const textLayer = document.getElementById("textLayer");

let texts = []; 
// { id, text, x, y, size, color }

function createTextElement(obj) {
  const el = document.createElement("div");
  el.className = "text-item";
  el.innerText = obj.text;
  el.style.fontSize = obj.size + "px";
  el.style.color = obj.color;
  el.style.left = obj.x * 100 + "%";
  el.style.top = obj.y * 100 + "%";
  el.dataset.id = obj.id;

  makeDraggable(el);
  textLayer.appendChild(el);
}

addTextBtn.addEventListener("click", () => {
  if (!textInput.value.trim()) return;

  const obj = {
    id: crypto.randomUUID(),
    text: textInput.value,
    x: 0.5,
    y: 0.5,
    size: Number(textSizeInput.value),
    color: textColorInput.value
  };

  texts.push(obj);
  createTextElement(obj);
});

