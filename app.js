const PDF_FILE = "./via_crucis_chapter_1.pdf";

const bookElement = document.getElementById("book");
const prevButton = document.getElementById("prev-page");
const nextButton = document.getElementById("next-page");
const themeToggle = document.getElementById("theme-dark");
const soundToggle = document.getElementById("sound-enabled");
const pageStatus = document.getElementById("page-status");
const message = document.getElementById("message");

const THEME_STORAGE_KEY = "via-crucis-theme";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

let flipbook = null;
let pageCount = 0;
let audioContext = null;
let soundEnabled = true;

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggle.checked = theme === "dark";
}

function initializeTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  applyTheme(initialTheme);

  themeToggle.addEventListener("change", () => {
    const theme = themeToggle.checked ? "dark" : "light";
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  });
}

function setMessage(text) {
  message.textContent = text;
}

function updateControls(currentPage) {
  pageStatus.textContent = `Page ${currentPage} / ${pageCount}`;

  prevButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= pageCount;
}

function buildPageElement(canvas) {
  const page = document.createElement("div");
  page.className = "page";
  page.appendChild(canvas);
  return page;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playPageTurnSound() {
  if (!soundEnabled || !window.AudioContext) {
    return;
  }

  ensureAudioContext();

  const now = audioContext.currentTime;
  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  for (let i = 0; i < output.length; i += 1) {
    output[i] = (Math.random() * 2 - 1) * 0.22;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1500, now);
  filter.frequency.exponentialRampToValueAtTime(700, now + 0.22);
  filter.Q.setValueAtTime(0.55, now);

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  noise.start(now);
  noise.stop(now + 0.22);
}

async function renderPdfPages(pdf) {
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    pages.push(buildPageElement(canvas));
  }

  return pages;
}

function setupFlipbook(pageElements) {
  bookElement.innerHTML = "";

  pageElements.forEach((page) => {
    bookElement.appendChild(page);
  });

  flipbook = new St.PageFlip(bookElement, {
    width: 580,
    height: 820,
    size: "stretch",
    minWidth: 280,
    maxWidth: 1100,
    minHeight: 400,
    maxHeight: 1400,
    maxShadowOpacity: 0.35,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    startZIndex: 10,
    flippingTime: 780,
  });

  const pages = bookElement.querySelectorAll(".page");
  flipbook.loadFromHTML(pages);

  flipbook.on("flip", (event) => {
    updateControls(event.data + 1);
    playPageTurnSound();
  });

  updateControls(1);

  prevButton.addEventListener("click", () => {
    flipbook.flipPrev();
  });

  nextButton.addEventListener("click", () => {
    flipbook.flipNext();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      flipbook.flipPrev();
    }

    if (event.key === "ArrowRight") {
      flipbook.flipNext();
    }
  });

  soundToggle.addEventListener("change", () => {
    soundEnabled = soundToggle.checked;

    if (soundEnabled) {
      ensureAudioContext();
    }
  });
}

async function init() {
  try {
    initializeTheme();
    setMessage("Rendering pages...");

    const pdf = await pdfjsLib.getDocument(PDF_FILE).promise;
    pageCount = pdf.numPages;

    const pageElements = await renderPdfPages(pdf);
    setupFlipbook(pageElements);

    setMessage("Use buttons, swipe, or arrow keys to turn pages.");
  } catch (error) {
    console.error(error);
    setMessage(
      "Could not load the PDF. Keep the PDF file in this folder and verify the filename in app.js."
    );
  }
}

init();
