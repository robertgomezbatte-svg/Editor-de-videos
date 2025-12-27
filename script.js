const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

const videoInput = document.getElementById("videoInput");
const musicInput = document.getElementById("musicInput");
const speedSelect = document.getElementById("speed");
const transitionSelect = document.getElementById("transition");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const preview = document.getElementById("preview");

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

  const speed = speedSelect.value;
  const transition = transitionSelect.value;

  let videoFilter = `setpts=PTS/${speed}`;
  let audioFilter = `atempo=${speed}`;

  if (transition === "fade") {
    videoFilter += ",fade=t=in:st=0:d=0.3,fade=t=out:st=2:d=0.3";
  }

  if (transition === "flash") {
    videoFilter += ",eq=brightness=0.8:contrast=1.2";
  }

  if (transition === "bounce") {
    videoFilter += ",zoompan=z='if(lte(on,5),1.1,1)':d=1";
  }

  status.innerText = "Procesando vídeo...";

  let command = [
    "-i", "input.mp4",
    "-vf", videoFilter,
    "-af", audioFilter,
    "-c:v", "libx264",
    "-profile:v", "high",
    "-crf", "18",
    "-preset", "slow",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "320k",
    "output.mp4"
  ];

  if (musicInput.files.length) {
    command = [
      "-i", "input.mp4",
      "-i", "music.mp3",
      "-filter_complex",
      `[0:v]${videoFilter}[v];[0:a]${audioFilter}[a0];[a0][1:a]amix=inputs=2:weights=2 0.3[a]`,
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "slow",
      "-c:a", "aac",
      "-b:a", "320k",
      "output.mp4"
    ];
  }

  await ffmpeg.run(...command);

  const data = ffmpeg.FS("readFile", "output.mp4");
  const videoURL = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));

  preview.src = videoURL;
  status.innerText = "Vídeo listo (calidad alta)";
};
