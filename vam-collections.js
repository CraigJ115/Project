// main API bits
const BASE_URL = "https://api.vam.ac.uk/v2/objects/search";
const makeImgUrl = (id, width) =>
  `https://framemark.vam.ac.uk/collections/${id}/full/${width},/0/default.jpg`;
const makeItemUrl = (sysNum) => `https://collections.vam.ac.uk/item/${sysNum}/`;

// grab data from the V&A API
async function fetchData(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`V&A API error (${res.status})`);
  }

  return res.json();
}

// app state
let state = {
  inputVal: "car",
  query: "car",

  page: 1,
  pageSize: 15,

  view: "grid",

  results: [],
  total: 0,

  loading: true,
  error: null,

  selectedId: null,
  modalData: null,
  modalLoading: false,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// load search results
async function loadResults() {
  setState({ loading: true, error: null });

  const { query, page, pageSize } = state;
  const params = new URLSearchParams({
    page,
    page_size: pageSize,
  });

  if (query) params.set("q", query);

  try {
    const data = await fetchData(`${BASE_URL}?${params}`);
    setState({
      results: data.records || [],
      total: data.info?.record_count || 0,
      loading: false,
    });
  } catch (err) {
    setState({
      error: err.message,
      loading: false,
    });
  }
}

// open modal with one object
async function openModal(id) {
  setState({
    selectedId: id,
    modalData: null,
    modalLoading: true,
  });

  try {
    const data = await fetchData(`https://api.vam.ac.uk/v2/museumobject/${id}`);
    setState({
      modalData: data.record,
      modalLoading: false,
    });
  } catch (err) {
    setState({
      modalLoading: false,
    });
  }
}

function closeModal() {
  setState({
    selectedId: null,
    modalData: null,
  });
}

// stop random html chaos
function escapeHTML(str) {
  if (!str) return "";

  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function noImageHTML() {
  return `<div class="no-img-msg">No image available</div>`;
}

function makeImg(imgId, size, title) {
  if (!imgId) return noImageHTML();

  const src = makeImgUrl(imgId, size);

  return `
    <img 
      src="${src}" 
      alt="${escapeHTML(title)}"
      onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'no-img-msg',textContent:'No image available'}))"
    >
  `;
}

function locationIcon() {
  return `
    <svg width="10" height="13" viewBox="0 0 10 13" fill="currentColor">
      <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 5 3.25a1.75 1.75 0 0 1 0 3.5z"/>
    </svg>
  `;
}

function makeGridCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  const makerName = item._primaryMaker?.name || "";
  const date = item._primaryDate || "";
  const place = item._currentLocation?.displayName || "";
  const onDisplay = item.onDisplay;

  return `
    <div class="card-grid" data-id="${item.systemNumber}">
      <div class="card-img-wrap">
        ${makeImg(imgId, "200", title)}
      </div>

      <div class="card-body">
        <div class="card-title">${escapeHTML(title)}</div>

        ${makerName ? `<div class="card-maker">${escapeHTML(makerName)}</div>` : ""}
        ${date ? `<div class="card-date">${escapeHTML(date)}</div>` : ""}
        ${
          place
            ? `<div class="card-location">${locationIcon()} ${escapeHTML(place)}</div>`
            : ""
        }

        <div class="${onDisplay ? "on-display-label yes" : "not-on-display"}">
          ${onDisplay ? "On display" : "Not on display"}
        </div>
      </div>
    </div>
  `;
}

function makeListCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  const makerName = item._primaryMaker?.name || "";
  const date = item._primaryDate || "";
  const place = item._currentLocation?.displayName || "";
  const onDisplay = item.onDisplay;

  return `
    <div class="card-list" data-id="${item.systemNumber}">
      <div class="card-list-thumb">
        ${makeImg(imgId, "100", title)}
      </div>

      <div class="card-list-info">
        <div class="card-title">${escapeHTML(title)}</div>

        ${makerName ? `<div class="card-maker">${escapeHTML(makerName)}</div>` : ""}
        ${date ? `<div class="card-date">${escapeHTML(date)}</div>` : ""}
        ${
          place
            ? `<div class="card-location">${locationIcon()} ${escapeHTML(place)}</div>`
            : ""
        }

        <div class="${onDisplay ? "on-display-label yes" : "not-on-display"}">
          ${onDisplay ? "On display" : "Not on display"}
        </div>
      </div>
    </div>
  `;
}

function makePagination() {
  const { page, total, pageSize } = state;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) {
    return {
      paginationHtml: "",
      pageSizeHtml: "",
    };
  }

  const pageSet = new Set([1, totalPages]);

  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageSet.add(i);
  }

  const pages = [...pageSet].sort((a, b) => a - b);

  let html = `<div class="pagination">`;

  html += `
    <button class="btn-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>
      ‹ Back
    </button>
  `;

  pages.forEach((pg, i) => {
    const prev = pages[i - 1];

    if (prev && pg - prev > 1) {
      html += `<span class="pagination-ellipsis">…</span>`;
    }

    html += `
      <button class="btn-page${pg === page ? " active" : ""}" data-page="${pg}">
        ${String(pg).padStart(2, "0")}
      </button>
    `;
  });

  html += `
    <button class="btn-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>
      Next
    </button>
  `;

  html += `</div>`;

  const pageSizeHtml = `
    <div class="page-size-row">
      Results per page:
      <span class="${pageSize === 15 ? "active" : ""}" data-size="15">15</span>
      <span class="${pageSize === 50 ? "active" : ""}" data-size="50">50</span>
    </div>
  `;

  return { paginationHtml: html, pageSizeHtml };
}

function makeModal() {
  const { selectedId, modalData, modalLoading } = state;

  if (!selectedId) return "";

  let body = "";

  if (modalLoading) {
    body = `
      <div style="width:100%;padding:4rem;display:flex;align-items:center;justify-content:center">
        <div class="spinner"></div>
      </div>
    `;
  } else if (!modalData) {
    body = `<p class="modal-error">Could not load details.</p>`;
  } else {
    const imgId = modalData.images?.[0]?.imageId || modalData.images?.[0] || "";
    const title =
      modalData.titles?.[0]?.title || modalData._primaryTitle || "Untitled";
    const maker =
      modalData.artistMakerPerson?.[0]?.name?.text ||
      modalData.artistMakerOrganisations?.[0]?.name?.text ||
      "";
    const date = modalData.productionDates?.[0]?.date?.text || "";
    const type = modalData.objectType || "";
    const materials = modalData.materials?.map((m) => m.text).join(", ") || "";
    const place = modalData.productionPlaces?.[0]?.place?.text || "";
    const desc = modalData.briefDescription || "";
    const accession = modalData.accessionNumber || selectedId;

    const rows = [
      ["Maker", maker],
      ["Date", date],
      ["Place", place],
      ["Materials", materials],
      ["Accession", accession],
    ]
      .filter(([, val]) => val)
      .map(
        ([label, val]) => `
          <div class="modal-meta-row">
            <span class="modal-meta-key">${label}</span>
            <span>${escapeHTML(val)}</span>
          </div>
        `
      )
      .join("");

    body = `
      <div class="modal-img-panel">
        ${makeImg(imgId, "500", title)}
      </div>

      <div class="modal-info-panel">
        ${type ? `<div class="modal-object-type">${escapeHTML(type)}</div>` : ""}
        <h2 class="modal-title">${escapeHTML(title)}</h2>
        <div class="modal-meta">${rows}</div>
        ${desc ? `<div class="modal-desc">${escapeHTML(desc)}</div>` : ""}
        <button class="more-like-this-btn" id="btn-more-like-this">Find more like this</button>
      </div>
    `;
  }

  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <button class="modal-close" id="btn-modal-close">×</button>
        ${body}
      </div>
    </div>
  `;
}

// main render
function render() {
  const {
    inputVal,
    query,
    view,
    results,
    total,
    loading,
    error,
  } = state;

  const input = document.getElementById("search-input");
  if (input && document.activeElement !== input) {
    input.value = inputVal;
  }

  ["grid", "list"].forEach((mode) => {
    const btn = document.getElementById(`btn-view-${mode}`);
    if (btn) btn.classList.toggle("active", view === mode);
  });

  const countEl = document.getElementById("result-count");
  const queryEl = document.getElementById("result-query");

  if (countEl) {
    if (loading) {
      countEl.textContent = "Searching...";
      if (queryEl) queryEl.textContent = "";
    } else if (error) {
      countEl.innerHTML = `<span style="color:#c0392b;font-size:15px">Error: ${escapeHTML(error)}</span>`;
    } else {
      countEl.textContent = `${total.toLocaleString()} objects`;
      if (queryEl) queryEl.textContent = query ? `matching "${query}"` : "";
    }
  }

  const resultsEl = document.getElementById("results");

  if (resultsEl) {
    if (loading) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <div class="spinner"></div>
          <p>Searching the collection...</p>
        </div>
      `;
    } else if (error) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <p style="color:#c0392b">Something went wrong loading the results.</p>
        </div>
      `;
    } else if (!results.length) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <p style="font-size:16px;margin-bottom:6px">No results found</p>
          <p>Try searching for something else.</p>
        </div>
      `;
    } else {
      const wrapperClass = view === "grid" ? "results-grid" : "results-list";
      resultsEl.innerHTML = `
        <div class="${wrapperClass}">
          ${results.map((item) => (view === "grid" ? makeGridCard(item) : makeListCard(item))).join("")}
        </div>
      `;
    }
  }

  const { paginationHtml, pageSizeHtml } = loading
    ? { paginationHtml: "", pageSizeHtml: "" }
    : makePagination();

  const paginationEl = document.getElementById("pagination");
  const pageSizeEl = document.getElementById("page-size-row");

  if (paginationEl) paginationEl.innerHTML = paginationHtml;
  if (pageSizeEl) pageSizeEl.innerHTML = pageSizeHtml || "";

  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) modalRoot.innerHTML = makeModal();

  attachEventsAgain();
}

// re-attach events after render because innerHTML wipes them out
function attachEventsAgain() {
  document.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  document.querySelectorAll("[data-page]").forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener("click", () => {
        setState({ page: Number(btn.dataset.page) });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  });

  document.querySelectorAll("[data-size]").forEach((el) => {
    el.addEventListener("click", () => {
      setState({
        pageSize: Number(el.dataset.size),
        page: 1,
      });
      loadResults();
    });
  });

  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  const closeBtn = document.getElementById("btn-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  const moreLikeBtn = document.getElementById("btn-more-like-this");
  if (moreLikeBtn) moreLikeBtn.addEventListener("click", runMoreLikeThis);
}

// stuff that only needs setting up once
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("btn-search-go");

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      setState({
        query: e.target.value,
        page: 1,
      });
      loadResults();
    }
  });

  searchInput.addEventListener("input", (e) => {
    state = {
      ...state,
      inputVal: e.target.value,
    };
  });

  searchBtn.addEventListener("click", () => {
    setState({
      query: state.inputVal,
      page: 1,
    });
    loadResults();
  });

  render();
  loadResults();
  initVoice();
});

// voice search helper words
const synonyms = {
  doll: "dolls",
  toy: "toys",
  bike: "bicycle",
  bicycle: "bicycles",
  dress: "fashion",
  clothes: "fashion",
  clothing: "fashion",
  hat: "hats",
  gun: "firearms",
  sword: "swords",
  knife: "knives",
  weapon: "weapons",
  clock: "timepieces",
  watch: "watches",
  timepiece: "timepieces",
  ring: "jewellery",
  necklace: "jewellery",
  jewel: "jewellery",
  jewelry: "jewellery",
  phone: "telephones",
  telephone: "telephones",
  chair: "furniture",
  table: "furniture",
  sofa: "furniture",
  pot: "ceramics",
  vase: "ceramics",
  bowl: "ceramics",
  cup: "ceramics",
  painting: "paintings",
  drawing: "drawings",
  print: "prints",
  photo: "photographs",
  photograph: "photographs",
  picture: "photographs",
  book: "books",
  map: "maps",
  poster: "posters",
  shoe: "shoes",
  boot: "boots",
  bag: "bags",
  lamp: "lighting",
  light: "lighting",
  candle: "candlesticks",
  coin: "coins",
  medal: "medals",
  stamp: "stamps",
  ship: "ships",
  boat: "boats",
  plane: "aircraft",
  airplane: "aircraft",
  train: "railways",
  railway: "railways",
  god: "religion",
  church: "religion",
  cross: "religion",
};

function setVoiceStatus(message) {
  const statusEl = document.getElementById("voice-status");
  if (statusEl) statusEl.textContent = message;
}

function runVoiceSearch(term) {
  const cleanTerm = (term || "").trim();

  if (!cleanTerm) {
    setVoiceStatus("Didn’t catch that.");
    return;
  }

  const searchTerm = synonyms[cleanTerm.toLowerCase()] || cleanTerm;
  const input = document.getElementById("search-input");

  if (input) input.value = searchTerm;

  setVoiceStatus(`Searching for "${searchTerm}"`);
  setState({
    inputVal: searchTerm,
    query: searchTerm,
    page: 1,
  });

  loadResults();
}

function runMoreLikeThis() {
  const { modalData } = state;

  if (!modalData) {
    setVoiceStatus("No item is open.");
    return;
  }

  const type = modalData.objectType || "";
  const category = modalData.categories?.[0]?.text || "";
  const searchTerm = type || category;

  if (!searchTerm) {
    setVoiceStatus("Couldn’t find anything similar for this one.");
    return;
  }

  closeModal();
  setVoiceStatus(`Finding more like "${searchTerm}"`);

  const input = document.getElementById("search-input");
  if (input) input.value = searchTerm;

  setState({
    inputVal: searchTerm,
    query: searchTerm,
    page: 1,
  });

  loadResults();
}

function openResultByIndex(index) {
  const { results } = state;

  if (!results.length) {
    setVoiceStatus("No results to open.");
    return;
  }

  if (index >= results.length) {
    setVoiceStatus(`Only ${results.length} results showing right now.`);
    return;
  }

  openModal(results[index].systemNumber);
  setVoiceStatus(`Opening result ${index + 1}`);
}

function initVoice() {
  const micBtn = document.getElementById("btn-mic");
  const interactBtn = document.getElementById("btn-voice-interact");

  if (!window.annyang) {
    if (micBtn) micBtn.disabled = true;
    if (interactBtn) interactBtn.disabled = true;

    setVoiceStatus("Voice search unavailable.");
    return;
  }

  annyang.removeCommands();

  annyang.addCommands({
    // searching
    "search for *term": runVoiceSearch,
    "find *term": runVoiceSearch,
    "show me *term": runVoiceSearch,
    "look for *term": runVoiceSearch,

    // page movement
    "next page": () => {
      const { page, total, pageSize } = state;
      const totalPages = Math.ceil(total / pageSize);

      if (page < totalPages) {
        setState({ page: page + 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Next page.");
      } else {
        setVoiceStatus("Already on the last page.");
      }
    },

    "previous page": () => {
      if (state.page > 1) {
        setState({ page: state.page - 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },

    "go back": () => {
      if (state.selectedId) {
        closeModal();
        setVoiceStatus("Closed.");
      } else if (state.page > 1) {
        setState({ page: state.page - 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },

    "first page": () => {
      setState({ page: 1 });
      loadResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setVoiceStatus("Back to page one.");
    },

    // change layout
    "grid view": () => {
      setState({ view: "grid" });
      setVoiceStatus("Grid view.");
    },
    "list view": () => {
      setState({ view: "list" });
      setVoiceStatus("List view.");
    },
    "show grid": () => {
      setState({ view: "grid" });
      setVoiceStatus("Grid view.");
    },
    "show list": () => {
      setState({ view: "list" });
      setVoiceStatus("List view.");
    },

    // scrolling
    "scroll down": () => {
      window.scrollBy({ top: 400, behavior: "smooth" });
      setVoiceStatus("Scrolling down.");
    },
    "scroll up": () => {
      window.scrollBy({ top: -400, behavior: "smooth" });
      setVoiceStatus("Scrolling up.");
    },
    "go to top": () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setVoiceStatus("Going to top.");
    },
    "go to bottom": () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      setVoiceStatus("Going to bottom.");
    },

    // modal stuff
    "close": closeModal,
    "close modal": closeModal,
    "more like this": runMoreLikeThis,
    "show me more like this": runMoreLikeThis,

    // open result by number
    "open first result": () => openResultByIndex(0),
    "open second result": () => openResultByIndex(1),
    "open third result": () => openResultByIndex(2),
    "open fourth result": () => openResultByIndex(3),
    "open fifth result": () => openResultByIndex(4),

    "open result one": () => openResultByIndex(0),
    "open result two": () => openResultByIndex(1),
    "open result three": () => openResultByIndex(2),
    "open result four": () => openResultByIndex(3),
    "open result five": () => openResultByIndex(4),

    // page size
    "show fifteen results": () => {
      setState({
        pageSize: 15,
        page: 1,
      });
      loadResults();
      setVoiceStatus("Showing 15 results.");
    },

    "show fifty results": () => {
      setState({
        pageSize: 50,
        page: 1,
      });
      loadResults();
      setVoiceStatus("Showing 50 results.");
    },

    // fallback
    "*term": runVoiceSearch,
  });

  const startListening = () => {
    setVoiceStatus("Listening...");
    annyang.start({
      autoRestart: false,
      continuous: false,
    });
  };

  annyang.addCallback("start", () => {
    if (micBtn) micBtn.classList.add("is-listening");
    if (interactBtn) interactBtn.classList.add("is-listening");
    setVoiceStatus("Listening...");
  });

  annyang.addCallback("end", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");

    setTimeout(() => {
      const status = document.getElementById("voice-status")?.textContent;

      if (
        status &&
        !status.includes("Searching") &&
        !status.includes("page") &&
        !status.includes("view") &&
        !status.includes("Finding")
      ) {
        setVoiceStatus("Done. Click to speak again.");
      }
    }, 500);
  });

  annyang.addCallback("error", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setVoiceStatus("Mic error. Check browser permission.");
  });

  annyang.addCallback("resultNoMatch", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setVoiceStatus("Didn’t catch that. Try again.");
  });

  if (micBtn) micBtn.addEventListener("click", startListening);
  if (interactBtn) interactBtn.addEventListener("click", startListening);
}