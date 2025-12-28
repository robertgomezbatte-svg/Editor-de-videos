const preview = document.getElementById("preview");
const videoInput = document.getElementById("videoInput");

const textInput = document.getElementById("textInput");
const textSizeInput = document.getElementById("textSize");
const textColorInput = document.getElementById("textColor");
const addTextBtn = document.getElementById("addTextBtn");
const deleteTextBtn = document.getElementById("deleteTextBtn");
const textLayer = document.getElementById("textLayer");

let texts = [];
let selectedTextId = null;

/* VIDEO LOAD */
videoInput.onchange = () => {
  preview.src = URL.createObjectURL(videoInput.files[0]);
};

/* CREATE TEXT */
addTextBtn.onclick = () => {
  if (!textInput.value.trim()) return;

  const obj = {
    id: crypto.randomUUID(),
    text: textInput.value,
    x: 0.5,
    y: 0.5,
    size: 36,
    color: "#ffffff"
  };

  texts.push(obj);
  renderTexts();
  selectText(obj.id);
};

/* DELETE TEXT */
deleteTextBtn.onclick = () => {
  if (!selectedTextId) return;
  texts = texts.filter(t => t.id !== selectedTextId);
  selectedTextId = null;
  renderTexts();
  clearTextControls();
};

/* RENDER TEXTS */
function renderTexts() {
  textLayer.innerHTML = "";

  texts.forEach(t => {
    const el = document.createElement("div");
    el.className = "text-item" + (t.id === selectedTextId ? " selected" : "");
    el.innerText = t.text;
    el.style.left = t.x * 100 + "%";
    el.style.top = t.y * 100 + "%";
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

/* SELECT TEXT */
function selectText(id) {
  selectedTextId = id;
  const t = texts.find(x => x.id === id);
  if (!t) return;

  textInput.value = t.text;
  textSizeInput.value = t.size;
  textColorInput.value = t.color;
  renderTexts();
}

function clearTextControls() {
  textInput.value = "";
  textSizeInput.value = 36;
  textColorInput.value = "#ffffff";
}

/* UPDATE TEXT CONTROLS */
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

/* DRAG TEXT */
function makeDraggable(el) {
  let startX, startY, startLeft, startTop;

  el.onmousedown = (e) => {
    e.preventDefault();
    const rect = textLayer.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = el.offsetLeft;
    startTop = el.offsetTop;

    function move(ev) {
      let x = startLeft + (ev.clientX - startX);
      let y = startTop + (ev.clientY - startY);
      x = Math.max(0, Math.min(rect.width, x));
      y = Math.max(0, Math.min(rect.height, y));
      el.style.left = x + "px";
      el.style.top = y + "px";
    }

    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);

      const t = texts.find(x => x.id === el.dataset.id);
      if (t) {
        t.x = el.offsetLeft / rect.width;
        t.y = el.offsetTop / rect.height;
      }
    }

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
}
