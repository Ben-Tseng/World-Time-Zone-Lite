const DEFAULT_LOCATIONS = [
  { name: "Beijing", timezone: "Asia/Shanghai", label: "China", cityKey: "beijing" },
  { name: "Manila", timezone: "Asia/Manila", label: "Philippines", cityKey: "manila" },
  { name: "New York", timezone: "America/New_York", label: "USA", cityKey: "new-york" },
  { name: "London", timezone: "Europe/London", label: "United Kingdom", cityKey: "london" }
];

const cityDatabase = [
  ["New York","America/New_York","USA"], ["London","Europe/London","United Kingdom"],
  ["Paris","Europe/Paris","France"], ["Berlin","Europe/Berlin","Germany"],
  ["Moscow","Europe/Moscow","Russia"], ["Dubai","Asia/Dubai","United Arab Emirates"],
  ["Sydney","Australia/Sydney","Australia"], ["Los Angeles","America/Los_Angeles","USA"],
  ["Chicago","America/Chicago","USA"], ["Toronto","America/Toronto","Canada"],
  ["Vancouver","America/Vancouver","Canada"], ["Singapore","Asia/Singapore","Singapore"],
  ["Seoul","Asia/Seoul","South Korea"], ["Hong Kong","Asia/Hong_Kong","China"],
  ["Shanghai","Asia/Shanghai","China"], ["Beijing","Asia/Shanghai","China"],
  ["Tokyo","Asia/Tokyo","Japan"], ["Mumbai","Asia/Kolkata","India"],
  ["Delhi","Asia/Kolkata","India"], ["San Francisco","America/Los_Angeles","USA"],
  ["Denver","America/Denver","USA"], ["Rio de Janeiro","America/Sao_Paulo","Brazil"],
  ["Sao Paulo","America/Sao_Paulo","Brazil"], ["Cape Town","Africa/Johannesburg","South Africa"],
  ["Cairo","Africa/Cairo","Egypt"], ["Mexico City","America/Mexico_City","Mexico"],
  ["Bangkok","Asia/Bangkok","Thailand"], ["Manila","Asia/Manila","Philippines"],
  ["Baguio","Asia/Manila","Philippines"], ["Cebu","Asia/Manila","Philippines"],
  ["Taipei","Asia/Taipei","Taiwan"], ["Kuala Lumpur","Asia/Kuala_Lumpur","Malaysia"],
  ["Jakarta","Asia/Jakarta","Indonesia"], ["Auckland","Pacific/Auckland","New Zealand"],
  ["Honolulu","Pacific/Honolulu","USA"], ["Seattle","America/Los_Angeles","USA"],
  ["Boston","America/New_York","USA"], ["Montreal","America/Toronto","Canada"],
  ["Calgary","America/Edmonton","Canada"], ["Vancouver","America/Vancouver","Canada"]
].map(([name, timezone, label]) => ({ name, timezone, label }));

const els = {
  container: document.getElementById("timeline-container"),
  emptyState: document.getElementById("empty-state"),
  overlay: document.getElementById("selection-overlay"),
  tooltip: document.getElementById("selection-tooltip"),
  searchInput: document.getElementById("location-search"),
  searchResults: document.getElementById("search-results"),
  searchButton: document.getElementById("search-add-button"),
  dateStrip: document.getElementById("date-strip"),
  datePicker: document.getElementById("date-picker-input"),
  todayButton: document.getElementById("today-button"),
  emptyAddButton: document.getElementById("empty-add-button")
};

let locations = DEFAULT_LOCATIONS.map(x => ({ ...x }));
let currentDate = startOfDay(new Date());
let homeTimezone = locations[0]?.timezone ?? "UTC";
let hoveredHourIndex = -1;
let hoveredGrid = null;
let renderTimer = null;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function formatDateInput(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function getParts(date, timezone, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...options
  }).formatToParts(date);
}

function getHour(date, timezone) {
  const part = getParts(date, timezone, { hour: "numeric", hour12: false })
    .find(p => p.type === "hour");
  return Number(part?.value ?? 0) % 24;
}

function getWeekday(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short"
  }).format(date);
}

function getTimeZoneAbbreviation(date, timezone) {
  return getParts(date, timezone, { timeZoneName: "short" })
    .find(p => p.type === "timeZoneName")?.value ?? timezone;
}

/*
  Robust enough for browser-only use: compare the rendered UTC clock
  and target-zone clock for the same instant. This preserves DST rules.
*/
function getOffsetMinutes(date, timezone) {
  const parts = getParts(date, timezone, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour) % 24, Number(values.minute), Number(values.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

function getHomeDayStartEpoch(date, timezone) {
  /*
    Find the UTC instant whose local calendar date/time is the selected
    home date at 00:00. Iterative correction handles DST transitions.
  */
  let guess = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0
  ));

  for (let i = 0; i < 4; i++) {
    const offset = getOffsetMinutes(guess, timezone);
    guess = new Date(Date.UTC(
      date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0
    ) - offset * 60000);
  }
  return guess.getTime();
}

function getDayNightClass(date, timezone) {
  const hour = getHour(date, timezone);
  return hour < 6 || hour >= 22 ? "night" : "day";
}

function setupSearch() {
  els.searchInput.addEventListener("input", () => {
    const query = els.searchInput.value.trim().toLowerCase();
    if (query.length < 1) {
      hideSearchResults();
      return;
    }

    const matches = cityDatabase.filter(city => {
      const duplicate = locations.some(
        l => l.name === city.name && l.timezone === city.timezone
      );
      const searchable = `${city.name} ${city.label} ${city.timezone}`.toLowerCase();
      return !duplicate && searchable.includes(query);
    });

    renderSearchResults(matches.slice(0, 30));
  });

  els.searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") hideSearchResults();
  });

  els.searchButton.addEventListener("click", e => {
    e.stopPropagation();
    els.searchInput.focus();
    const available = cityDatabase.filter(city =>
      !locations.some(l => l.name === city.name && l.timezone === city.timezone)
    );
    renderSearchResults(available.slice(0, 30));
  });

  document.addEventListener("click", e => {
    if (!els.searchResults.contains(e.target) &&
        !els.searchInput.contains(e.target) &&
        !els.searchButton.contains(e.target)) {
      hideSearchResults();
    }
  });
}

function renderSearchResults(matches) {
  els.searchResults.innerHTML = "";

  if (!matches.length) {
    els.searchResults.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-name">No matching location</div>
        <div class="search-result-meta">Try a city, country, or IANA timezone.</div>
      </div>`;
    els.searchResults.style.display = "block";
    return;
  }

  matches.forEach(city => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.innerHTML = `
      <div class="search-result-name">${escapeHTML(city.name)}</div>
      <div class="search-result-meta">${escapeHTML(city.label)} · ${escapeHTML(city.timezone)}</div>`;
    item.addEventListener("click", () => addLocation(city));
    els.searchResults.appendChild(item);
  });

  els.searchResults.style.display = "block";
}

function hideSearchResults() {
  els.searchResults.style.display = "none";
}

function addLocation(city) {
  if (locations.some(l => l.name === city.name && l.timezone === city.timezone)) return;
  locations.push({ ...city });
  hideSearchResults();
  els.searchInput.value = "";
  render();
}

function removeLocation(index) {
  if (index < 0 || index >= locations.length) return;

  const wasHome = locations[index].timezone === homeTimezone && index === 0;
  locations.splice(index, 1);

  if (locations.length === 0) {
    homeTimezone = null;
  } else if (wasHome) {
    homeTimezone = locations[0].timezone;
  }
  render();
}

window.removeLocation = removeLocation;

function setupDateControls() {
  els.todayButton.addEventListener("click", () => {
    currentDate = startOfDay(new Date());
    els.datePicker.value = formatDateInput(currentDate);
    renderDateStrip();
    render();
  });

  document.querySelector(".calendar-btn").addEventListener("click", e => {
    e.preventDefault();
    if (typeof els.datePicker.showPicker === "function") {
      els.datePicker.showPicker();
    } else {
      els.datePicker.click();
    }
  });

  els.datePicker.addEventListener("change", e => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split("-").map(Number);
    currentDate = new Date(y, m - 1, d);
    renderDateStrip();
    render();
  });
}

function renderDateStrip() {
  els.dateStrip.innerHTML = "";
  els.datePicker.value = formatDateInput(currentDate);

  for (let i = -2; i <= 3; i++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + i);

    const el = document.createElement("div");
    el.className = "date-item";
    if (i === 0) el.classList.add("selected");

    const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
    const dayNum = d.getDate();
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) el.classList.add("weekend");

    el.innerHTML = `
      <div style="font-size:.68em;opacity:.8">${dayName}</div>
      <div style="font-size:1.05em;font-weight:700">${dayNum}</div>`;

    el.addEventListener("click", () => {
      currentDate = startOfDay(d);
      renderDateStrip();
      render();
    });

    els.dateStrip.appendChild(el);
  }
}

function createLocationInfo(loc, index, liveNow) {
  const info = document.createElement("div");
  info.className = "location-info";

  const isHome = index === 0;
  const homeOffset = homeTimezone ? getOffsetMinutes(liveNow, homeTimezone) : 0;
  const localOffset = getOffsetMinutes(liveNow, loc.timezone);
  const diff = localOffset - homeOffset;

  const badgeHTML = isHome
    ? `<span class="home-icon" title="Home timezone">⌂</span>`
    : `<span class="offset-badge">${escapeHTML(formatOffset(diff))}</span>`;

  const timeString = new Intl.DateTimeFormat("en-US", {
    timeZone: loc.timezone, hour: "numeric", minute: "numeric", hour12: true
  }).format(liveNow);

  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: loc.timezone, weekday: "short", month: "short", day: "numeric"
  }).format(liveNow);

  const tzName = getTimeZoneAbbreviation(liveNow, loc.timezone);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.title = "Remove location";
  deleteBtn.setAttribute("aria-label", `Remove ${loc.name}`);
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", () => removeLocation(index));

  info.appendChild(deleteBtn);

  const header = document.createElement("div");
  header.className = "location-header-row";
  header.innerHTML = `
    ${badgeHTML}
    <div class="location-name">
      ${escapeHTML(loc.name)}
      <span style="font-size:.78em;font-weight:400;color:#94a3b8;margin-left:3px">${escapeHTML(tzName)}</span>
    </div>`;
  info.appendChild(header);

  const detail = document.createElement("div");
  detail.className = "location-detail";
  detail.textContent = `${loc.label} · ${loc.timezone}`;
  info.appendChild(detail);

  const time = document.createElement("div");
  time.className = "location-time";
  time.innerHTML = `${escapeHTML(timeString)} <span class="location-time-date">${escapeHTML(datePart)}</span>`;
  info.appendChild(time);

  return info;
}

function renderRow(loc, index, startEpoch, liveNow) {
  const row = document.createElement("div");
  row.className = "location-row";

  row.appendChild(createLocationInfo(loc, index, liveNow));

  const grid = document.createElement("div");
  grid.className = "time-grid";

  grid.addEventListener("mousemove", e => handleHover(e, grid));
  grid.addEventListener("mouseleave", () => {
    if (hoveredGrid === grid) {
      hoveredGrid = null;
      hideSelection();
    }
  });

  for (let i = 0; i < 24; i++) {
    const blockTime = new Date(startEpoch + i * 3600000);
    const block = document.createElement("div");
    block.className = `hour-block ${getDayNightClass(blockTime, loc.timezone)}`;

    const weekday = getWeekday(blockTime, loc.timezone);
    if (weekday === "Sat" || weekday === "Sun") block.classList.add("weekend-day");

    const hour = getHour(blockTime, loc.timezone);
    const displayLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: loc.timezone, hour: "numeric", hour12: true
    }).format(blockTime).replace(/\s/g, "").toLowerCase();

    const subLabel = hour === 0
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: loc.timezone, weekday: "short", day: "numeric"
        }).format(blockTime)
      : "";

    block.innerHTML = `
      <div class="hour-label">${escapeHTML(displayLabel)}</div>
      ${subLabel ? `<div class="day-label">${escapeHTML(subLabel)}</div>` : ""}`;

    grid.appendChild(block);
  }

  row.appendChild(grid);
  els.container.appendChild(row);
}

function render() {
  cancelAnimationFrame(renderTimer);
  renderTimer = requestAnimationFrame(() => {
    els.container.innerHTML = "";
    hideSelection();

    const hasLocations = locations.length > 0;
    els.emptyState.hidden = hasLocations;

    if (!hasLocations) return;

    homeTimezone = locations[0].timezone;
    const startEpoch = getHomeDayStartEpoch(currentDate, homeTimezone);
    const liveNow = new Date();

    locations.forEach((loc, index) => {
      renderRow(loc, index, startEpoch, liveNow);
    });
  });
}

function handleHover(e, grid) {
  const rect = grid.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
  const index = Math.min(23, Math.floor(x / (rect.width / 24)));

  hoveredHourIndex = index;
  hoveredGrid = grid;
  updateSelectionOverlay(grid, index, e.clientX, e.clientY);
}

function updateSelectionOverlay(grid, index, clientX, clientY) {
  const appRect = document.querySelector(".app-container").getBoundingClientRect();
  const rect = grid.getBoundingClientRect();
  const blockWidth = rect.width / 24;
  const left = rect.left - appRect.left + index * blockWidth;

  els.overlay.style.display = "block";
  els.overlay.style.left = `${left}px`;
  els.overlay.style.width = `${blockWidth}px`;

  const row = grid.closest(".location-row");
  const rowIndex = [...els.container.children].indexOf(row);

  // Calculate the actual instant represented by the selected home-hour column.
  const instant = new Date(
    getHomeDayStartEpoch(currentDate, homeTimezone) + index * 3600000
  );

  const comparisons = locations.map(loc => {
    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: loc.timezone, hour: "numeric", minute: "2-digit", hour12: true
    }).format(instant);
    return `${loc.name}: ${localTime}`;
  });

  els.tooltip.textContent = comparisons.join("  •  ");
  els.tooltip.style.display = "block";
  els.tooltip.style.left = `${Math.min(clientX + 12, window.innerWidth - els.tooltip.offsetWidth - 10)}px`;
  els.tooltip.style.top = `${Math.max(8, clientY - 42)}px`;
}

function hideSelection() {
  hoveredHourIndex = -1;
  hoveredGrid = null;
  els.overlay.style.display = "none";
  els.tooltip.style.display = "none";
}

els.emptyAddButton.addEventListener("click", () => {
  els.searchInput.focus();
  els.searchButton.click();
});

setupSearch();
setupDateControls();
renderDateStrip();
render();

setInterval(() => {
  render();
}, 60000);

window.addEventListener("resize", () => {
  hideSelection();
  render();
});
