const PDF_FILE = "./via_crucis_chapter_1.pdf";
const EPUB_FILE = "./via_crucis_chapter_1.epub";

const bookElement = document.getElementById("book");
const bookStage = document.querySelector(".book-stage");
const prevButton = document.getElementById("prev-page");
const nextButton = document.getElementById("next-page");
const downloadMenu = document.getElementById("download-menu");
const downloadPdfLink = document.getElementById("download-pdf");
const downloadEpubLink = document.getElementById("download-epub");
const focusModeButton = document.getElementById("focus-mode");
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
let isBookOnlyMode = false;

function refreshBookLayout() {
  // Give the DOM a frame to apply size classes before forcing a flipbook recalculation.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (flipbook && typeof flipbook.update === "function") {
        flipbook.update();
      }
    });
  });
}

function applyBookOnlyMode(enabled) {
  isBookOnlyMode = enabled;
  document.body.classList.toggle("book-only", enabled);
  focusModeButton.classList.toggle("is-active", enabled);
  focusModeButton.setAttribute("aria-label", enabled ? "Exit full view" : "Enter full view");
  focusModeButton.setAttribute("title", enabled ? "Exit full view" : "Enter full view");
  refreshBookLayout();
}

async function toggleBookView() {
  if (!document.fullscreenEnabled) {
    applyBookOnlyMode(!isBookOnlyMode);
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await bookStage.requestFullscreen();
}

function initializeBookViewToggle() {
  focusModeButton.addEventListener("click", async () => {
    try {
      await toggleBookView();
    } catch (error) {
      console.error(error);
      applyBookOnlyMode(!isBookOnlyMode);
    }
  });

  document.addEventListener("fullscreenchange", () => {
    applyBookOnlyMode(Boolean(document.fullscreenElement));
  });

  window.addEventListener("resize", refreshBookLayout);
}

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

function setupDownloads() {
  downloadPdfLink.href = PDF_FILE;
  downloadPdfLink.setAttribute("download", PDF_FILE.split("/").pop());

  downloadEpubLink.href = EPUB_FILE;
  downloadEpubLink.setAttribute("download", EPUB_FILE.split("/").pop());

  [downloadPdfLink, downloadEpubLink].forEach((link) => {
    link.addEventListener("click", () => {
      downloadMenu.removeAttribute("open");
    });
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

async function getPageLinkHotspots(pdfPage, viewport) {
  try {
    const annotations = await pdfPage.getAnnotations({ intent: "display" });

    return annotations
      .filter((annotation) => annotation.subtype === "Link")
      .map((annotation) => {
        const href = annotation.url || annotation.unsafeUrl;
        if (!href || !annotation.rect) {
          return null;
        }

        const bounds = viewport.convertToViewportRectangle(annotation.rect);
        const left = Math.min(bounds[0], bounds[2]);
        const top = Math.min(bounds[1], bounds[3]);
        const width = Math.abs(bounds[2] - bounds[0]);
        const height = Math.abs(bounds[3] - bounds[1]);

        if (width <= 0 || height <= 0) {
          return null;
        }

        return {
          href,
          leftPct: (left / viewport.width) * 100,
          topPct: (top / viewport.height) * 100,
          widthPct: (width / viewport.width) * 100,
          heightPct: (height / viewport.height) * 100,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Could not read PDF annotations for links", error);
    return [];
  }
}

function createLinkLayer(hotspots) {
  const layer = document.createElement("div");
  layer.className = "link-layer";

  hotspots.forEach((hotspot) => {
    const link = document.createElement("a");
    link.className = "pdf-link-hotspot";
    link.href = hotspot.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.left = `${hotspot.leftPct}%`;
    link.style.top = `${hotspot.topPct}%`;
    link.style.width = `${hotspot.widthPct}%`;
    link.style.height = `${hotspot.heightPct}%`;

    // Prevent drag-to-flip handlers from hijacking link interactions.
    ["pointerdown", "mousedown", "touchstart", "click"].forEach((eventName) => {
      link.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    layer.appendChild(link);
  });

  return layer;
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
    const pdfPage = await pdf.getPage(pageIndex);
    const viewport = pdfPage.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({
      canvasContext: context,
      viewport,
    }).promise;

    const pageElement = buildPageElement(canvas);
    const hotspots = await getPageLinkHotspots(pdfPage, viewport);

    if (hotspots.length > 0) {
      pageElement.appendChild(createLinkLayer(hotspots));
    }

    pages.push(pageElement);
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
    initializeBookViewToggle();
    setupDownloads();
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
