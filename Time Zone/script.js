const locations = [
    { name: "Chicago", timezone: "America/Chicago", label: "USA" },
    { name: "Hong Kong", timezone: "Asia/Hong_Kong", label: "China" },
    { name: "Japan", timezone: "Asia/Tokyo", label: "Tokyo Time" },
    { name: "India", timezone: "Asia/Kolkata", label: "IST" }
];

// Expanded City Database for Search
const cityDatabase = [
    { name: "New York", timezone: "America/New_York", label: "USA" },
    { name: "London", timezone: "Europe/London", label: "United Kingdom" },
    { name: "Paris", timezone: "Europe/Paris", label: "France" },
    { name: "Berlin", timezone: "Europe/Berlin", label: "Germany" },
    { name: "Moscow", timezone: "Europe/Moscow", label: "Russia" },
    { name: "Dubai", timezone: "Asia/Dubai", label: "United Arab Emirates" },
    { name: "Sydney", timezone: "Australia/Sydney", label: "Australia" },
    { name: "Los Angeles", timezone: "America/Los_Angeles", label: "USA" },
    { name: "Toronto", timezone: "America/Toronto", label: "Canada" },
    { name: "Singapore", timezone: "Asia/Singapore", label: "Singapore" },
    { name: "Seoul", timezone: "Asia/Seoul", label: "South Korea" },
    { name: "San Francisco", timezone: "America/Los_Angeles", label: "USA" },
    { name: "Denver", timezone: "America/Denver", label: "USA" },
    { name: "Rio de Janeiro", timezone: "America/Sao_Paulo", label: "Brazil" },
    { name: "Cape Town", timezone: "Africa/Johannesburg", label: "South Africa" },
    { name: "Shanghai", timezone: "Asia/Shanghai", label: "China" }
];

const container = document.getElementById('timeline-container');
const selectionOverlay = document.getElementById('selection-overlay');
const searchInput = document.getElementById('location-search');
const searchResults = document.getElementById('search-results');
const dateStrip = document.getElementById('date-strip');
const datePickerInput = document.getElementById('date-picker-input');

// Global state
let hoveredHourIndex = -1;
let currentDate = new Date(); // The date we are viewing

function init() {
    setupSearch();
    setupDateControls();
    renderDateStrip();
    render();
    setInterval(updateCurrentTime, 60000); // Update every minute
}

// --- Search Functionality ---

function setupSearch() {
    // Input typing listener
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        const matches = cityDatabase.filter(city =>
            city.name.toLowerCase().includes(query) &&
            !locations.some(l => l.name === city.name && l.timezone === city.timezone)
        );

        renderSearchResults(matches);
    });

    // Icon click listener (Show All)
    const searchIcon = document.querySelector('.search-icon');
    searchIcon.style.cursor = 'pointer';
    searchIcon.addEventListener('click', () => {
        if (searchResults.style.display === 'block') {
            searchResults.style.display = 'none';
        } else {
            const available = cityDatabase.filter(city =>
                !locations.some(l => l.name === city.name && l.timezone === city.timezone)
            );
            renderSearchResults(available);
        }
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !searchIcon.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function renderSearchResults(matches) {
    searchResults.innerHTML = '';
    if (matches.length === 0) {
        searchResults.style.display = 'none';
        return;
    }

    matches.forEach(city => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = `${city.name}, ${city.label}`;
        div.addEventListener('click', () => {
            addLocation(city);
            searchInput.value = '';
            searchResults.style.display = 'none';
        });
        searchResults.appendChild(div);
    });

    searchResults.style.display = 'block';
}

function addLocation(city) {
    locations.push(city);
    render();
}

// Make globally accessible for the onclick handler
window.removeLocation = function (index) {
    locations.splice(index, 1);
    render();
};

// --- Date Functionality ---

function setupDateControls() {
    // Calendar Icon click -> Trigger Picker
    const calendarBtn = document.querySelector('.calendar-btn');

    calendarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (datePickerInput.showPicker) {
            datePickerInput.showPicker();
        } else {
            datePickerInput.click();
        }
    });

    // When date picker changes
    datePickerInput.addEventListener('change', (e) => {
        if (e.target.value) {
            // e.target.value is YYYY-MM-DD
            const [y, m, d] = e.target.value.split('-').map(Number);
            currentDate = new Date(y, m - 1, d);
            renderDateStrip();
            render();
        }
    });
}

function renderDateStrip() {
    dateStrip.innerHTML = '';

    // Render -2 to +4 days from current Date state
    for (let i = -2; i <= 3; i++) {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + i);

        const el = document.createElement('div');
        el.className = 'date-item';
        if (i === 0) el.classList.add('selected');

        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
        const dayNum = d.getDate();

        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) el.classList.add('weekend');

        el.innerHTML = `
            <div style="font-size:0.7em; opacity:0.8">${dayName}</div>
            <div style="font-size:1.1em; font-weight:bold">${dayNum}</div>
        `;

        el.addEventListener('click', () => {
            currentDate = d;
            renderDateStrip();
            render();
        });

        dateStrip.appendChild(el);
    }
}

// --- Main Render ---

function getFormattedTime(timezone, baseDate) {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
    }).format(baseDate);
}

function render() {
    container.innerHTML = '';

    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');

    // Align with the FIRST location's timezone (Home)
    const homeTz = locations[0].timezone;

    // We want the first column to be 00:00 of Home Location
    // Heuristic: Start with UTC midnight + offset guess
    let pivot = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // Start mid-day UTC to be safe
    // Check Home time of pivot
    let parts = new Intl.DateTimeFormat('en-US', {
        timeZone: homeTz,
        hour: 'numeric', hour12: false
    }).formatToParts(pivot);
    let h = parseInt(parts.find(p => p.type === 'hour').value) % 24;

    // Adjust pivot so proper local time is 00:00
    // If h=12, we are 12 hours ahead. Subtract 12.
    if (h !== 0) {
        if (h > 12) pivot = new Date(pivot.getTime() + (24 - h) * 3600000);
        else pivot = new Date(pivot.getTime() - h * 3600000);
    }

    // Double check consistency if date boundary crossed weirdly, but usually fine for simple use.
    const startEpoch = pivot.getTime();

    // Real-time "Now" marker needs to be calculated relative to startEpoch
    const nowEpoch = new Date().getTime();

    // Render Rows
    locations.forEach((loc, index) => {
        const row = document.createElement('div');
        row.className = 'location-row';

        // Info Column
        const info = document.createElement('div');
        info.className = 'location-info';

        const liveNow = new Date();
        const timeString = new Intl.DateTimeFormat('en-US', {
            timeZone: loc.timezone, hour: 'numeric', minute: 'numeric', hour12: true
        }).format(liveNow);

        const datePart = new Intl.DateTimeFormat('en-US', {
            timeZone: loc.timezone, weekday: 'short', month: 'short', day: 'numeric'
        }).format(liveNow);

        // Offset Calculation (vs Home)
        let badgeHTML = '';
        if (index === 0) {
            badgeHTML = '<span class="home-icon">⌂</span>';
        } else {
            const getUtcOffset = (tz) => {
                const date = new Date();
                const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
                const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
                return (tzDate.getTime() - utcDate.getTime()) / 6e4;
            };
            const homeOffset = getUtcOffset(locations[0].timezone);
            const locOffset = getUtcOffset(loc.timezone);
            const diffMinutes = locOffset - homeOffset;
            const diffHours = Math.round(diffMinutes / 60);
            const sign = diffHours >= 0 ? '+' : '';
            badgeHTML = `<span class="offset-badge">${sign}${diffHours}</span>`;
        }

        // Timezone Abbreviation
        const tzParts = new Intl.DateTimeFormat('en-US', {
            timeZone: loc.timezone,
            timeZoneName: 'short'
        }).formatToParts(liveNow);
        const tzName = tzParts.find(p => p.type === 'timeZoneName').value;

        // Delete Button HTML
        const deleteBtnHTML = `<div class="delete-btn" title="Remove location" onclick="removeLocation(${index})">×</div>`;

        info.innerHTML = `
            ${deleteBtnHTML}
            <div class="location-header-row">
                ${badgeHTML}
                <div class="location-name">${loc.name} <span style="font-size:0.8em; font-weight:400; color:#94a3b8; margin-left:4px">${tzName}</span></div>
            </div>
            <div class="location-detail">${loc.label}</div>
            <div class="location-time">${timeString} <span style="font-size:0.8em; font-weight:400; color:#666">${datePart}</span></div>
        `;
        row.appendChild(info);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'time-grid';
        grid.addEventListener('mousemove', (e) => handleHover(e, grid));
        grid.addEventListener('mouseleave', () => {
            // Optional clear
        });

        // 24 Hour Blocks
        for (let i = 0; i < 24; i++) {
            const blockTime = new Date(startEpoch + (i * 3600 * 1000));

            const block = document.createElement('div');
            block.className = 'hour-block';

            const h = parseInt(new Intl.DateTimeFormat('en-US', {
                timeZone: loc.timezone, hour: 'numeric', hour12: false
            }).format(blockTime));

            const isNight = (h < 6 || h >= 22);
            if (isNight) block.classList.add('night');
            else block.classList.add('day');

            // Weekend check
            const dayShort = new Intl.DateTimeFormat('en-US', { timeZone: loc.timezone, weekday: 'short' }).format(blockTime);
            if (dayShort === 'Sat' || dayShort === 'Sun') block.classList.add('weekend-day');

            // Label
            const displayLabel = new Intl.DateTimeFormat('en-US', {
                timeZone: loc.timezone, hour: 'numeric', hour12: true
            }).format(blockTime).replace(' ', '').toLowerCase();

            // Day label (Mon, Tue) if 00:00 (midnight)
            let subLabel = '';
            if (h === 0) {
                subLabel = new Intl.DateTimeFormat('en-US', {
                    timeZone: loc.timezone, weekday: 'short', day: 'numeric'
                }).format(blockTime);
            }

            block.innerHTML = `
                <div class="hour-label">${displayLabel}</div>
                ${subLabel ? `<div class="day-label">${subLabel}</div>` : ''}
            `;

            grid.appendChild(block);
        }

        row.appendChild(grid);
        container.appendChild(row);
    });
}

function handleHover(e, grid) {
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const totalBlocks = 24;
    const blockWidth = width / totalBlocks;

    const index = Math.floor(x / blockWidth);

    if (index >= 0 && index < 24) {
        hoveredHourIndex = index;
        updateSelectionOverlay(rect.left, blockWidth, index);
    }
}

function updateSelectionOverlay(gridLeft, blockWidth, index) {
    const appRect = document.querySelector('.app-container').getBoundingClientRect();
    const relativeLeft = gridLeft - appRect.left;
    const leftPos = relativeLeft + (index * blockWidth);

    selectionOverlay.style.display = 'block';
    selectionOverlay.style.left = `${leftPos}px`;
    selectionOverlay.style.width = `${blockWidth}px`;
}

function updateCurrentTime() {
    render();
}

// Initial Run
init();

// Handle resize
window.addEventListener('resize', () => {
    render();
    selectionOverlay.style.display = 'none';
});
