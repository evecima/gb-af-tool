(() => {
  const DATA = window.APARTMENT_DATA || [];
  const byUnit = new Map(DATA.map(r => [r.unit, r]));
  const byNumber = new Map(DATA.map(r => [String(r.number), r]));
  const byBuilding = new Map();

  for (const r of DATA) {
    if (!byBuilding.has(r.building)) byBuilding.set(r.building, []);
    byBuilding.get(r.building).push(r);
  }
  for (const arr of byBuilding.values()) arr.sort((a,b) => a.number - b.number);

  const $ = (id) => document.getElementById(id);
  const aptInput = $("apt");
  const result = $("result");
  const buildingSelect = $("building");
  const buildingResult = $("buildingResult");
  const offlineStatus = $("offlineStatus");
  const installBtn = $("installBtn");

  function normalize(value) {
    return String(value || "").trim().toUpperCase().replace(/[\s\-_.]/g, "");
  }

  function lookupApartment() {
    const q = normalize(aptInput.value);
    if (!q) {
      result.className = "result";
      result.innerHTML = "";
      return;
    }
    let record = byUnit.get(q);
    if (!record && /^\d+$/.test(q)) {
      record = byNumber.get(String(parseInt(q, 10)));
    }
    renderApartment(record);
  }

  function renderApartment(record) {
    if (!record) {
      result.className = "result show notfound";
      result.innerHTML = `
        <div class="apt-eyebrow">No match</div>
        <div class="apt-value">Apartment not found</div>
        <div class="hint">Check the number and try again.</div>`;
      return;
    }
    result.className = "result show";
    result.innerHTML = `
      <div class="apt-eyebrow">Apartment</div>
      <div class="apt-value">${record.unit}</div>
      <div class="building-label">Building</div>
      <div class="building-value">${record.building}</div>`;
  }

  [...byBuilding.keys()].sort((a,b) => Number(a)-Number(b)).forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = `Building ${b}`;
    buildingSelect.appendChild(opt);
  });

  buildingSelect.addEventListener("change", () => {
    const b = buildingSelect.value;
    if (!b) {
      buildingResult.innerHTML = "";
      return;
    }
    const units = byBuilding.get(b) || [];
    buildingResult.innerHTML = `
      <div class="building-head">Building ${b}</div>
      <div class="units">${units.map(r => `<span class="unit">${r.unit}</span>`).join("")}</div>
      <div class="count">${units.length} apartment${units.length === 1 ? "" : "s"}</div>`;
  });

  $("findBtn").addEventListener("click", lookupApartment);
  aptInput.addEventListener("keydown", e => {
    if (e.key === "Enter") lookupApartment();
  });
  aptInput.addEventListener("input", () => {
    if (normalize(aptInput.value).length >= 1) {
      lookupApartment();
    } else {
      result.className = "result";
      result.innerHTML = "";
    }
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.panel).classList.add("active");
      if (tab.dataset.panel === "searchPanel") {
        setTimeout(() => aptInput.focus(), 50);
      }
    });
  });

  function updateConnection() {
    if (navigator.onLine) {
      offlineStatus.textContent = "Ready";
      offlineStatus.title = "Online. The installed app can also work offline.";
    } else {
      offlineStatus.textContent = "Offline";
      offlineStatus.title = "No internet connection; local apartment lookup is still available.";
    }
  }
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  updateConnection();

  // PWA install prompt on supported browsers.
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "block";
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = "none";
  });

  // Service workers require HTTPS or localhost; the app still works when index.html is opened directly.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  // Focus the main lookup field on larger screens; mobile browsers may intentionally suppress autofocus.
  if (window.matchMedia("(min-width: 700px)").matches) aptInput.focus();
})();
