Vconst { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

const videoInput = document.getElementById("videoInput");
const musicInput = document.getElementById("musicInput");
const speedSelect = document.getElementById("speed");
const transitionSelect = document.getElementById("transition");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const preview = document.getElementById("preview");

let duration = 0;
let inPoint = 0;
let outPoint = 0;
let cuts = [];

/* =========================
   PREVIEW & TIMELINE
========================= */

preview.addEventListener("loadedmetadata", () => {
  duration = preview.duration;
});

preview.addEventListener("timeupdate", () => {
  const percent = preview.currentTime / duration;
  document.getElementById("playhead").style.left = `${percent * 100}%`;
});

const timeline = document.getElementById("timeline");
const selection = document.getElementById("selection");

timeline.addEventListener("click", (e) => {
  const rect = timeline.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  preview.currentTime = percent * duration;
});

document.getElementById("setIn").onclick = () => {
  inPoint = preview.currentTime;
  updateSelection();
};

document.getElementById("setOut").onclick = () => {
  outPoint = preview.currentTime;
  updateSelection();
};

document.getElementById("addCut").onclick = () => {
  if (outPoint > inPoint) {
    cuts.push([inPoint, outPoint]);
    renderCuts();
  }
};

document.getElementById("clearCuts").onclick = () => {
  cuts = [];
  renderCuts();
  selection.style.width = "0";
};

function updateSelection() {
  const start = (inPoint / duration) * 100;
  const end = (outPoint / duration) * 100;
  selection.style.left = `${start}%`;
  selection.style.width = `${end - start}%`;
}

function renderCuts() {
  const list = document.getElementById("cutsList");
  list.innerHTML = "";

  cuts.forEach((cut, i) => {
    const li = document.createElement("li");
    li.textContent = `Corte ${i + 1}: ${cut[0].toFixed(2)}s → ${cut[1].toFixed(2)}s`;
    list.appendChild(li);
  });
}

/* =========================
   PROCESAR VÍDEO
========================= */

processBtn.onclick = async () => {
  if (!videoInput.files.length) {
    alert("Sube un vídeo primero");
    return;
  }

  status.innerText = "Cargando FFmpeg...";
  if (!ffmpeg.isLoaded()) await ffmpeg.load();

  ffmpeg.FS("writeFile", "input.mp4", await fetchFile(videoInput.files[0]));

  if (musicInput.files.length) {
    ffmpeg.FS("writeFile", "music.mp3", await fetchFile(musicInput.files[0]));
  }

  // Si no hay cortes, usar todo el vídeo
  if (cuts.length === 0) {
    cuts.push([0, duration]);
  }

  // Crear archivo de concatenación
  let concatFile = "";
  for (let i = 0; i < cuts.length; i++) {
    concatFile += `file input.mp4\n`;
    concatFile += `inpoint ${cuts[i][0]}\n`;
    concatFile += `outpoint ${cuts[i][1]}\n`;
  }

  ffmpeg.FS("writeFile", "cuts.txt", concatFile);

  const speed = speedSelect.value;
  const transition = transitionSelect.value;

  let videoFilter = `setpts=PTS/${speed}`;
  let audioFilter = `atempo=${speed}`;

  if (transition === "fade") {
    videoFilter += ",fade=t=in:st=0:d=0.3";
  }
  if (transition === "flash") {
    videoFilter += ",eq=brightness=0.8:contrast=1.2";
  }
  if (transition === "bounce") {
    videoFilter += ",zoompan=z='if(lte(on,5),1.1,1)':d=1";
  }

  status.innerText = "Procesando vídeo...";

  let command;

  if (musicInput.files.length) {
    command = [
      "-f", "concat",
      "-safe", "0",
      "-i", "cuts.txt",
      "-i", "music.mp3",
      "-filter_complex",
      `[0:v]${videoFilter}[v];[0:a]${audioFilter}[a0];[a0][1:a]amix=inputs=2:weights=2 0.3[a]`,
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-profile:v", "high",
      "-crf", "18",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "320k",
      "output.mp4"
    ];
  } else {
    command = [
      "-f", "concat",
      "-safe", "0",
      "-i", "cuts.txt",
      "-vf", videoFilter,
      "-af", audioFilter,
      "-c:v", "libx264",
      "-profile:v", "high",
      "-crf", "18",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "320k",
      "output.mp4"
    ];
  }

  await ffmpeg.run(...command);

  const data = ffmpeg.FS("readFile", "output.mp4");
  const videoURL = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));

  preview.src = videoURL;
  status.innerText = "Vídeo listo (cortes aplicados, calidad máxima)";
};

