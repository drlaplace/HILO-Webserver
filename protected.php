<?php
session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header("Location: service.html");
    exit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Servicebereich</title>
    <style>
        body { font-family: sans-serif; margin: 0; background: #f4f4f4; }
        .header {
            display: flex; align-items: center; justify-content: space-between;
            background: #fff; padding: 8px 16px; border-bottom: 2px solid #ccc; margin-bottom: 20px;
        }
        .header img { height: 50px; }
        .header nav ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 20px; }
        .header nav a { text-decoration: none; font-weight: bold; color: #333; }
        .content {
            padding: 16px 20px; max-width: 968px; margin: 0 auto 16px auto;
            background: #fff; border-radius: 8px; box-shadow: 0 0 8px rgba(0,0,0,0.08);
        }
        /* ── Tabs ── */
        #voltage-panel {
            max-width: 860px; margin: 0 auto 20px auto;
            background: #fff; border: 1px solid #aaa; border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;
        }
        .tab-bar {
            display: flex; border-bottom: 2px solid #aaa; background: #f0f0f0;
        }
        .tab-btn {
            flex: 1; padding: 10px 4px; font-size: 13px; font-weight: bold;
            border: none; border-right: 1px solid #aaa; background: #e0e0e0;
            cursor: pointer; color: #555; transition: background 0.15s;
            min-width: 0; white-space: nowrap;
        }
        #voltage-panel { max-width: 1000px; }
        .tab-btn:last-child { border-right: none; }
        .tab-btn.active {
            background: #fff; color: #000; border-bottom: 2px solid #fff;
            margin-bottom: -2px;
        }
        .tab-btn:hover:not(.active) { background: #d4d4d4; }
        .tab-pane { display: none; padding: 14px 18px; }
        .tab-pane.active { display: block; }
        /* ── Panel inneres Layout ── */
        .panel-title {
            text-align: center; margin: 0 0 12px 0; font-size: 15px; font-weight: normal;
        }
        .panel-body { display: flex; gap: 16px; align-items: flex-start; }
        .left-col { flex: 0 0 340px; }
        .pol-btn {
            width: 100%; padding: 6px; font-size: 18px; font-weight: bold;
            border: 1px solid #aaa; background: #f0f0f0; cursor: pointer;
            border-radius: 4px; margin-bottom: 10px;
        }
        .input-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 6px 12px; margin-bottom: 10px;
        }
        .step-input-row { display: flex; align-items: center; gap: 4px; font-size: 13px; }
        .step-input-row button {
            width: 22px; height: 22px; font-size: 14px; font-weight: bold;
            border: 1px solid #aaa; background: #eee; cursor: pointer;
            border-radius: 3px; line-height: 1; padding: 0;
        }
        .step-input-row input {
            width: 58px; text-align: center; border: 1px solid #aaa;
            border-radius: 3px; padding: 2px 4px; font-size: 13px;
        }
        .total-row {
            border: 1px solid #aaa; padding: 6px 10px;
            display: flex; align-items: center; gap: 8px;
            font-size: 14px; border-radius: 4px; background: #fafafa;
        }
        .total-row input {
            width: 64px; font-size: 15px; font-weight: bold; text-align: center;
            border: 1px solid #aaa; border-radius: 3px; padding: 2px 4px;
        }
        .right-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .right-top { display: flex; justify-content: space-between; align-items: center; }
        .right-top button {
            padding: 4px 12px; font-size: 13px;
            border: 1px solid #aaa; background: #f0f0f0;
            cursor: pointer; border-radius: 4px;
        }
        .col-numbers, .col-voltages {
            display: flex; justify-content: space-around; padding: 0 4px;
        }
        .col-numbers { font-size: 12px; font-weight: bold; }
        .col-voltages { font-size: 9px; color: #555; }
        .col-numbers span, .col-voltages span { width: 36px; text-align: center; }
        .section-input {
            width: 52px; font-size: 11px; text-align: center;
            border: 1px solid #bbb; border-radius: 3px; padding: 2px 3px;
            color: #333; background: #fff;
        }
        .section-input:focus { border-color: #3a7fc1; outline: none; background: #eef4ff; }
        .slider-area {
            display: flex; justify-content: space-around; align-items: center;
            height: 180px; border: 1px solid #ccc; border-radius: 4px;
            background: #f9f9f9; padding: 8px 4px; box-sizing: border-box;
        }
        .vslider-wrap { display: flex; flex-direction: column; align-items: center; width: 36px; }
        .vslider-wrap input[type=range] {
            -webkit-appearance: slider-vertical;
            appearance: slider-vertical;
            writing-mode: vertical-lr; direction: rtl;
            width: 22px; height: 150px;
            cursor: pointer; accent-color: #3a7fc1;
        }
        @supports not (appearance: slider-vertical) {
            .vslider-wrap input[type=range] {
                -webkit-appearance: none; appearance: none;
                width: 150px; height: 22px;
                transform: rotate(-90deg);
                transform-origin: 75px 75px;
                margin: 64px -64px;
                accent-color: #3a7fc1;
            }
        }
        .btn-ok {
            width: 100%; padding: 8px; font-size: 16px; font-weight: bold;
            border: 1px solid #aaa; background: #f0f0f0;
            cursor: pointer; border-radius: 4px; margin-top: 2px;
        }
        .status-msg {
            font-size: 13px; min-height: 18px; color: green;
        }
        .status-msg.error { color: red; }

        /* ── GPIO Tab ── */
        #pane-3 { padding: 12px 16px; }
        .gpio-port-block { margin-bottom: 14px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
        .gpio-port-title { background: #e8e8e8; font-size: 12px; font-weight: bold; padding: 4px 10px; border-bottom: 1px solid #ddd; color: #333; }
        .gpio-row { display: flex; flex-wrap: wrap; gap: 8px 12px; padding: 10px; align-items: flex-end; }
        .gpio-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .gpio-label { font-size: 10px; text-align: center; color: #333; line-height: 1.2; max-width: 40px; word-break: break-word; }
        .gpio-led { width: 26px; height: 26px; border-radius: 50%; background: #4caf50; border: 2px solid #2e7d32; box-shadow: 0 0 5px rgba(76,175,80,0.4); transition: background 0.12s; }
        .gpio-led.on  { background: #f44336; border-color: #b71c1c; box-shadow: 0 0 6px rgba(244,67,54,0.6); }
        .gpio-led.off { background: #4caf50; border-color: #2e7d32; }
        .gpio-led.unknown { background: #9e9e9e; border-color: #616161; box-shadow: none; }
        .gpio-led.output { cursor: pointer; }
        .gpio-led.output:hover { opacity: 0.8; }
        .gpio-bottom-bar { display: flex; border-top: 2px solid #ccc; margin-top: 12px; }
        .gpio-bottom-btn { flex: 1; padding: 11px; font-size: 15px; font-weight: bold; border: none; border-right: 1px solid #ccc; background: #f5f5f5; cursor: pointer; }
        .gpio-bottom-btn:last-child { border-right: none; }
        .gpio-bottom-btn:hover { background: #e0e0e0; }
    </style>
</head>
<body>
<div class="header">
    <div class="logo"><img src="LOGO.bmp" alt="Logo"></div>
    <nav><ul>
        <li><a href="index.html">Generator</a></li>
        <li><a href="service.html">Service &amp; Support</a></li>
    </ul></nav>
</div>

<div class="content">
    <h1>Willkommen, <?php echo htmlspecialchars($_SESSION['username']); ?>!</h1>
    <p>Dies ist der geschützte Servicebereich.</p>
    <a href="logout.php">Abmelden</a>
</div>

<div id="voltage-panel">
    <div class="tab-bar" id="tab-bar"><!-- dynamisch --></div>
    <div id="tab-pane-container"><!-- dynamisch --></div>
    <!-- GPIO Tab bleibt statisch -->
    <div class="tab-pane" id="pane-gpio">
        <div id="gpio-port-container"><!-- filled by JS --></div>
    </div>

<script>
// ── State pro Tab (Index 0/1/2) ───────────────────────────────────────────────
let maxVoltage   = 12000;
let sliderLimits = [];   // gemeinsam für alle Tabs

let vControlTabs = [
    { index: 0, name: "Ladespannung" },
    { index: 1, name: "Upeak" },
    { index: 2, name: "Ipeak" }
]; // wird aus config.json überschrieben

let state = []; // wird nach config-Load initialisiert
let multiDeviceDef  = null;  // aktuelle multiDevice-Definition
let activeModuleRef = null;  // generatorRef des aktiven Moduls
let globalConfig    = null;  // komplette config.json global verfügbar

function initState() {
    state = vControlTabs.map(() => ({
        polarity:     1,
        adjPos:       new Array(10).fill(0),
        adjNeg:       new Array(10).fill(0),
        vControllPos: 100,
        vControllNeg: 100,
        sections:     null
    }));
}

// ── Startup ───────────────────────────────────────────────────────────────────
fetch("config.json?ts=" + Date.now())
    .then(r => r.json())
    .then(config => {
        globalConfig = config;  // global speichern
        const storedId = localStorage.getItem("generatorId");

        // Multi-Device prüfen
        const md = config.multiDevices && config.multiDevices[String(storedId)];
        if (md) {
            multiDeviceDef = md;
            buildModuleTabBar(md);
            // Ersten enabled Modul laden
            const firstEnabledIdx = md.modules.findIndex(m => m.enabled);
            if (firstEnabledIdx >= 0)
                loadModuleConfig(md.modules[firstEnabledIdx].generatorRef, firstEnabledIdx);
            return;
        }

        // Einzelgerät
        let gen = (storedId && config.generators[storedId])
            ? config.generators[storedId]
            : config.generators[Object.keys(config.generators)[0]];

        loadGenConfig(gen);
    })
    .catch(() => {
        buildLimits();
        [0, 1, 2].forEach(t => buildUI(t));
    });

function buildLimits() {
    sliderLimits = [];
    for (let i = 1; i <= 10; i++)
        sliderLimits.push(Math.round(maxVoltage * i / 10));
}

// ── Einzelnen Generator laden (Einzelgerät oder nach Modul-Auswahl) ───────────
function loadGenConfig(gen) {
    const voltParam = (gen.parameters || []).find(p => p.id === 'voltage');
    maxVoltage = voltParam ? parseInt(voltParam.max, 10) : 12000;
    buildLimits();
    if (gen.vControlTabs && gen.vControlTabs.length > 0) {
        vControlTabs = gen.vControlTabs;
    }
    initState();
    buildTabBar();
    Promise.all(vControlTabs.map((tab, t) => loadIniData(t)))
        .then(() => {
            vControlTabs.forEach((tab, t) => {
                buildUI(t);
                const s = state[t];
                const totalInp = document.getElementById(`total-${t}`);
                if (totalInp) totalInp.value = s.polarity > 0 ? s.vControllPos : s.vControllNeg;
                showStatus(t, "Werte geladen", false);
            });
        });
}

// ── Multi-Device: Modul-Tab-Leiste aufbauen ───────────────────────────────────
function buildModuleTabBar(md) {
    const bar = document.getElementById("tab-bar");
    if (!bar) return;
    bar.innerHTML = "";

    // Modul-Buttons (nur enabled)
    md.modules.forEach((mod, idx) => {
        if (!mod.enabled) return;
        const btn = document.createElement("button");
        btn.className = "tab-btn";
        btn.id = `mod-btn-${idx}`;
        btn.textContent = mod.label;
        btn.onclick = () => loadModuleConfig(mod.generatorRef, idx);
        bar.appendChild(btn);
    });

    // GPIO-Button immer am Ende
    const gpioBtn = document.createElement("button");
    gpioBtn.className = "tab-btn";
    gpioBtn.textContent = "GPIO";
    gpioBtn.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        gpioBtn.classList.add("active");
        const container = document.getElementById("tab-pane-container");
        if (container) container.style.display = "none";
        document.getElementById("pane-gpio").classList.add("active");
        startGpioPolling();
    };
    bar.appendChild(gpioBtn);
}

// ── Multi-Device: Modul aktivieren ────────────────────────────────────────────
function loadModuleConfig(generatorRef, activeIdx) {
    activeModuleRef = generatorRef;
    stopGpioPolling();

    // pfnId aus multiDeviceDef setzen
    const mod = multiDeviceDef.modules.find(m => m.generatorRef === generatorRef);
    if (mod) localStorage.setItem("pfnId", mod.pfnId);

    // Modul-Tab hervorheben
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    const activeBtn = document.getElementById(`mod-btn-${activeIdx}`);
    if (activeBtn) activeBtn.classList.add("active");

    // pane-gpio ausblenden, pane-container einblenden
    const gpioPane = document.getElementById("pane-gpio");
    if (gpioPane) gpioPane.classList.remove("active");
    const container = document.getElementById("tab-pane-container");
    if (container) container.style.display = "";

    // Generator-Config aus globalConfig laden
    const gen = globalConfig.generators[generatorRef];
    if (gen) loadGenConfig(gen);
}

// ── Tab-Leiste dynamisch aufbauen ─────────────────────────────────────────────
function buildTabBar() {
    const bar = document.getElementById("tab-bar");
    const container = document.getElementById("tab-pane-container");
    if (!bar || !container) return;

    // Bei Multi-Device: Modul-Buttons in tab-bar behalten, nur vControl-Tabs
    // in einem zweiten Sub-Tab-Bar anzeigen
    container.innerHTML = "";

    if (!multiDeviceDef) {
        // Einzelgerät: tab-bar komplett neu aufbauen
        bar.innerHTML = "";
    } else {
        // Multi-Device: Sub-Tab-Bar für vControlTabs unter dem Modul-Inhalt
        // Tab-Bar bleibt mit Modul-Buttons, wir fügen Sub-Tabs in container ein
        const subBar = document.createElement("div");
        subBar.id = "sub-tab-bar";
        subBar.style.cssText = "display:flex;gap:2px;margin-bottom:8px;border-bottom:1px solid #aaa;";
        container.appendChild(subBar);

        vControlTabs.forEach((tab, t) => {
            const btn = document.createElement("button");
            btn.className = "tab-btn" + (t === 0 ? " active" : "");
            btn.style.cssText = "font-size:12px;padding:4px 10px;";
            btn.textContent = tab.name;
            btn.onclick = () => switchTab(t);
            subBar.appendChild(btn);
        });

        // GPIO-Tab in sub-bar
        //const gpioBtn = document.createElement("button");
        //gpioBtn.className = "tab-btn";
        //gpioBtn.style.cssText = "font-size:12px;padding:4px 10px;";
        //gpioBtn.textContent = "GPIO";
        //gpioBtn.onclick = () => switchTab(vControlTabs.length);
        //subBar.appendChild(gpioBtn);

        vControlTabs.forEach((tab, t) => {
            const pane = document.createElement("div");
            pane.className = "tab-pane" + (t === 0 ? " active" : "");
            pane.id = `pane-${t}`;
            pane.innerHTML = buildPaneHTML(tab, t);
            container.appendChild(pane);
        });
        return; // früh raus — Panes schon gebaut
    }

    vControlTabs.forEach((tab, t) => {
        // Tab-Button (nur Einzelgerät)
        const btn = document.createElement("button");
        btn.className = "tab-btn" + (t === 0 ? " active" : "");
        btn.textContent = tab.name;
        btn.onclick = () => switchTab(t);
        bar.appendChild(btn);

        // Tab-Pane
        const pane = document.createElement("div");
        pane.className = "tab-pane" + (t === 0 ? " active" : "");
        pane.id = `pane-${t}`;
        pane.innerHTML = buildPaneHTML(tab, t);
        container.appendChild(pane);
    });

    // GPIO Tab-Button hinzufügen (nur Einzelgerät)
    const gpioBtn = document.createElement("button");
    gpioBtn.className = "tab-btn";
    gpioBtn.textContent = "GPIO";
    gpioBtn.onclick = () => switchTab(vControlTabs.length);
    bar.appendChild(gpioBtn);
}

function buildPaneHTML(tab, t) {
    return `
        <p class="panel-title">SW Anpassung der Ausgangsspannung &mdash; <em>${tab.name}</em></p>
        <div class="panel-body">
            <div class="left-col">
                <button class="pol-btn" id="pol-${t}" onclick="togglePolarity(${t})">+/-</button>
                <div class="input-grid" id="grid-${t}"></div>
                <div class="total-row">
                    <span>Gesamt Ausgabe:</span>
                    <input type="number" id="total-${t}" value="100" min="0" max="113" step="1"
                        onblur="validateTotal(${t})">
                    <span>%</span>
                </div>
            </div>
            <div class="right-col">
                <div class="right-top">
                    <span class="status-msg" id="status-${t}"></span>
                    <button onclick="resetAll(${t})">Alle Anpassungen zurücksetzen</button>
                </div>
                <div class="col-numbers"  id="nums-${t}"></div>
                <div class="col-voltages" id="volts-${t}"></div>
                <div class="slider-area"  id="sliders-${t}"></div>
                <button class="btn-ok" onclick="applySettings(${t})">Ok</button>
            </div>
        </div>`;
}

// ── Tab wechseln ──────────────────────────────────────────────────────────────
function switchTab(t) {
    const gpioTabIndex = vControlTabs.length; // GPIO ist immer letzter Tab
    // tab-pane-container sichtbar
    const container = document.getElementById("tab-pane-container");
    if (container) container.style.display = t === gpioTabIndex ? "none" : "";
    // Alle VControl-Panes
    vControlTabs.forEach((tab, i) => {
        const pane = document.getElementById(`pane-${i}`);
        if (pane) pane.classList.toggle("active", i === t);
    });
    // GPIO-Pane
    const gpioPane = document.getElementById("pane-gpio");
    if (gpioPane) gpioPane.classList.toggle("active", t === gpioTabIndex);
    // Tab-Buttons
    document.querySelectorAll(".tab-btn").forEach((b, i) =>
        b.classList.toggle("active", i === t));
    // GPIO Polling
    if (t === gpioTabIndex) startGpioPolling();
    else                    stopGpioPolling();
}

// ── UI aufbauen (pro Tab) ─────────────────────────────────────────────────────
function buildUI(t) {
    // Spaltennummern
    const numDiv = document.getElementById(`nums-${t}`);
    numDiv.innerHTML = "";
    for (let i = 1; i <= 10; i++) {
        const s = document.createElement("span");
        s.textContent = i;
        numDiv.appendChild(s);
    }
    // Spannungslabels als editierbare Inputs — Werte kommen aus state.sections
    const vDiv = document.getElementById(`volts-${t}`);
    vDiv.innerHTML = "";
    for (let i = 0; i < 10; i++) {
        const lim = getSectionLimit(t, i);
        const inp = document.createElement("input");
        inp.type = "number";
        inp.className = "section-input";
        inp.id = `sec-${t}-${i}`;
        inp.value = lim;
        inp.min = 1;
        inp.title = `Bereich ${i+1} Grenze (V)`;
        inp.addEventListener("change", () => onSectionChange(t, i));
        vDiv.appendChild(inp);
    }
    // Eingaberaster — Limits aus getSectionLimit (state bereits befüllt)
    const grid = document.getElementById(`grid-${t}`);
    grid.innerHTML = "";
    for (let i = 0; i < 10; i++) {
        const lim = getSectionLimit(t, i);
        const adjVal = (state[t].polarity > 0 ? state[t].adjPos : state[t].adjNeg)[i] || 0;
        const clamped = Math.max(-lim, Math.min(lim, adjVal));
        const row = document.createElement("div");
        row.className = "step-input-row";
        row.innerHTML = `
            <span style="min-width:22px;font-weight:bold;">${i+1}:</span>
            <button onclick="stepAdjust(${t},${i},-1)">−</button>
            <input type="number" id="adj-${t}-${i}" value="${clamped}"
                min="${-lim}" max="${lim}" oninput="onAdjInput(${t},${i})">
            <button onclick="stepAdjust(${t},${i},+1)">+</button>`;
        grid.appendChild(row);
    }
    // Slider — ebenfalls mit korrekten Limits und Werten aufbauen
    const area = document.getElementById(`sliders-${t}`);
    area.innerHTML = "";
    for (let i = 0; i < 10; i++) {
        const lim = getSectionLimit(t, i);
        const adjVal = (state[t].polarity > 0 ? state[t].adjPos : state[t].adjNeg)[i] || 0;
        const clamped = Math.max(-lim, Math.min(lim, adjVal));
        const wrap = document.createElement("div");
        wrap.className = "vslider-wrap";
        wrap.innerHTML = `
            <input type="range" id="slider-${t}-${i}"
                min="${-lim}" max="${lim}" step="1" value="${clamped}"
                oninput="onSliderInput(${t},${i})">`;
        area.appendChild(wrap);
    }
    // Gesamt-Ausgabe setzen
    const totalInp = document.getElementById(`total-${t}`);
    if (totalInp) totalInp.value = state[t].polarity > 0 ? state[t].vControllPos : state[t].vControllNeg;
}

// ── Bereichsgrenze lesen (aus state.sections oder Standardwert) ───────────────
function getSectionLimit(t, i) {
    const s = state[t];
    return (s.sections && s.sections[i] > 0) ? s.sections[i] : sliderLimits[i];
}

// ── Bereichsgrenze geändert → Slider + Input-Grenzen aktualisieren ────────────
function onSectionChange(t, i) {
    const inp = document.getElementById(`sec-${t}-${i}`);
    let lim = parseInt(inp.value, 10);
    if (isNaN(lim) || lim < 1) lim = sliderLimits[i];
    inp.value = lim;
    const s = state[t];
    if (!s.sections) s.sections = sliderLimits.slice();
    s.sections[i] = lim;
    // Slider und Adj-Input Grenzen anpassen
    const slider = document.getElementById(`slider-${t}-${i}`);
    const adj    = document.getElementById(`adj-${t}-${i}`);
    slider.min = -lim; slider.max = lim;
    adj.min    = -lim; adj.max    = lim;
    // Wert clampen falls nötig
    const cur = parseInt(adj.value, 10) || 0;
    const clamped = Math.max(-lim, Math.min(lim, cur));
    adj.value = clamped;
    slider.value = clamped;
    const arr = s.polarity > 0 ? s.adjPos : s.adjNeg;
    arr[i] = clamped;
}

// ── INI Daten laden (nur State füllen, kein DOM) ─────────────────────────────
function loadIniData(t) { 
    const url = `ini_handler.php?table=${t}&pfn=${getPfnId()}&ts=` + Date.now();
    // console.log(`[loadIniData] t=${t} url=${url} pfnId=${getPfnId()}`);
    return fetch(url)
        .then(r => {
            // console.log(`[loadIniData] t=${t} HTTP status=${r.status}`);
            return r.json();
        })
        .then(data => {
            // console.log(`[loadIniData] t=${t} response=`, JSON.stringify(data));
            if (data.error) { showStatus(t, "Fehler: " + data.error, true); return; }
            const s = state[t];
            s.adjPos       = data.pos;
            s.adjNeg       = data.neg;
            s.vControllPos = data.VControll;
            s.vControllNeg = data.VControllneg;
            if (data.sections && data.sections.length === 10) {
                s.sections = data.sections.map((v, i) => v > 0 ? v : sliderLimits[i]);
            } else {
                s.sections = sliderLimits.slice();
            }
            // console.log(`[loadIniData] t=${t} state=`, JSON.stringify(s));
        })
        .catch(err => {
            console.error(`[loadIniData] t=${t} catch:`, err);
            showStatus(t, "INI nicht lesbar: " + err.message, true);
        });
}

// ── INI lesen und UI aktualisieren (für manuelles Reload) ────────────────────
function loadIni(t) {
    loadIniData(t).then(() => {
        // Section-Inputs aktualisieren
        const s = state[t];
        for (let i = 0; i < 10; i++) {
            const secInp = document.getElementById(`sec-${t}-${i}`);
            if (secInp) {
                secInp.value = s.sections[i];
                onSectionChange(t, i);
            }
        }
        document.getElementById(`total-${t}`).value =
            s.polarity > 0 ? s.vControllPos : s.vControllNeg;
        applyCurrentPolarity(t);
        showStatus(t, "Werte geladen", false);
    });
}

// ── Polaritäts-Anzeige ────────────────────────────────────────────────────────
function applyCurrentPolarity(t) {
    const s   = state[t];
    const arr = s.polarity > 0 ? s.adjPos : s.adjNeg;
    for (let i = 0; i < 10; i++) {
        const lim = getSectionLimit(t, i);
        const val = Math.max(-lim, Math.min(lim, arr[i]));
        document.getElementById(`adj-${t}-${i}`).value = val;
        document.getElementById(`slider-${t}-${i}`).value = val;
    }
}

// ── +/- Umschalten ────────────────────────────────────────────────────────────
function togglePolarity(t) {
    saveCurrentToArray(t);
    state[t].polarity *= -1;
    const s = state[t];
    document.getElementById(`pol-${t}`).textContent = s.polarity > 0 ? "+" : "−";
    document.getElementById(`total-${t}`).value =
        s.polarity > 0 ? s.vControllPos : s.vControllNeg;
    applyCurrentPolarity(t);
}

// ── Aktuelle Felder → State ───────────────────────────────────────────────────
function saveCurrentToArray(t) {
    const s   = state[t];
    const arr = s.polarity > 0 ? s.adjPos : s.adjNeg;
    for (let i = 0; i < 10; i++)
        arr[i] = parseInt(document.getElementById(`adj-${t}-${i}`).value, 10) || 0;
    const tv = parseInt(document.getElementById(`total-${t}`).value, 10);
    if (!isNaN(tv)) {
        if (s.polarity > 0) s.vControllPos = tv; else s.vControllNeg = tv;
    }
}

// ── Slider ↔ Eingabe ──────────────────────────────────────────────────────────
function onSliderInput(t, i) {
    const val = parseInt(document.getElementById(`slider-${t}-${i}`).value, 10);
    const s   = state[t];
    (s.polarity > 0 ? s.adjPos : s.adjNeg)[i] = val;
    document.getElementById(`adj-${t}-${i}`).value = val;
}
function onAdjInput(t, i) {
    let val = parseInt(document.getElementById(`adj-${t}-${i}`).value, 10);
    if (isNaN(val)) return;
    const lim = sliderLimits[i];
    val = Math.max(-lim, Math.min(lim, val));
    const s = state[t];
    (s.polarity > 0 ? s.adjPos : s.adjNeg)[i] = val;
    document.getElementById(`slider-${t}-${i}`).value = val;
}
function stepAdjust(t, i, delta) {
    const lim = sliderLimits[i];
    const s   = state[t];
    const arr = s.polarity > 0 ? s.adjPos : s.adjNeg;
    arr[i] = Math.max(-lim, Math.min(lim, (arr[i] || 0) + delta));
    document.getElementById(`adj-${t}-${i}`).value = arr[i];
    document.getElementById(`slider-${t}-${i}`).value = arr[i];
}

// ── Validierung ───────────────────────────────────────────────────────────────
function validateTotal(t) {
    const inp = document.getElementById(`total-${t}`);
    let val = parseFloat(inp.value);
    if (isNaN(val)) val = 100;
    val = Math.max(0, Math.min(113, val));
    inp.value = val;
    const s = state[t];
    if (s.polarity > 0) s.vControllPos = val; else s.vControllNeg = val;
}

// ── Zurücksetzen ──────────────────────────────────────────────────────────────
function resetAll(t) {
    const s = state[t];
    s.adjPos    = new Array(10).fill(0);
    s.adjNeg    = new Array(10).fill(0);
    s.sections  = null;
    s.vControllPos = 100;
    s.vControllNeg = 100;
    document.getElementById(`total-${t}`).value = 100;
    // Sektionsinputs auf Standardwerte zurücksetzen
    for (let i = 0; i < 10; i++) {
        const secInp = document.getElementById(`sec-${t}-${i}`);
        if (secInp) secInp.value = sliderLimits[i];
        const slider = document.getElementById(`slider-${t}-${i}`);
        const adj    = document.getElementById(`adj-${t}-${i}`);
        if (slider) { slider.min = -sliderLimits[i]; slider.max = sliderLimits[i]; slider.value = 0; }
        if (adj)    { adj.min    = -sliderLimits[i]; adj.max    = sliderLimits[i]; adj.value    = 0; }
    }
    applyCurrentPolarity(t);
}

// ── Speichern ─────────────────────────────────────────────────────────────────
function applySettings(t) {
    saveCurrentToArray(t);
    validateTotal(t);
    const s = state[t];
    // Sektionsgrenzen aus Inputs lesen
    const sections = [];
    for (let i = 0; i < 10; i++) {
        const secInp = document.getElementById(`sec-${t}-${i}`);
        sections.push(secInp ? (parseInt(secInp.value, 10) || sliderLimits[i]) : sliderLimits[i]);
    }
    const payload = {
        table:        t,
        pfn:          parseInt(getPfnId(), 10),
        VControll:    s.vControllPos,
        VControllneg: s.vControllNeg,
        pos:          s.adjPos,
        neg:          s.adjNeg,
        sections:     sections
    };
    fetch("ini_handler.php", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
    })
    .then(r => {
        if (!r.ok) return r.text().then(txt => { throw new Error("HTTP " + r.status + ": " + txt.substring(0, 200)); });
        return r.json();
    })
    .then(data => {
        if (data.success) showStatus(t, "Gespeichert ✓", false);
        else showStatus(t, data.error || "Fehler beim Speichern", true);
    })
    .catch(err => showStatus(t, "Fehler: " + err.message, true));
}

// ── Status ────────────────────────────────────────────────────────────────────
function showStatus(t, msg, isError) {
    const el = document.getElementById(`status-${t}`);
    el.textContent = msg;
    el.className = "status-msg" + (isError ? " error" : "");
    setTimeout(() => { el.textContent = ""; el.className = "status-msg"; }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════════
// GPIO Tab
// ══════════════════════════════════════════════════════════════════════════════

function getGenId() { return localStorage.getItem("generatorId") || "63"; }
function getPfnId()  { return localStorage.getItem("pfnId")      || "9";  }

// Alle Signale aus gpio.txt, sortiert nach Port
const GPIO_PORTS = [
    { portNo:0, title:"Port 0 – Direkte GPIOs (Ausgänge & Eingänge)", signals:[
        { label:"B2",   index:5,  dir:"O" },
        { label:"Sync", index:6,  dir:"I" },
        { label:"A6",   index:8,  dir:"O" },
        { label:"A5",   index:12, dir:"O" },
        { label:"TTB",  index:13, dir:"O" },
        { label:"TRO",  index:14, dir:"O" },
        { label:"T2",   index:15, dir:"O" },
        { label:"A4",   index:16, dir:"O" },
        { label:"B1",   index:17, dir:"O" },
        { label:"T1",   index:18, dir:"O" },
        { label:"TR",   index:19, dir:"O" },
        { label:"A3",   index:20, dir:"O" },
        { label:"A2",   index:21, dir:"O" },
        { label:"A10",  index:22, dir:"O" },
        { label:"A9",   index:23, dir:"O" },
        { label:"A8",   index:24, dir:"O" },
        { label:"A7",   index:25, dir:"O" },
        { label:"A1",   index:26, dir:"O" },
        { label:"Si",   index:27, dir:"I" },
    ]},
    { portNo:1, title:"Port 1 – Eingänge", signals:[
        { label:"RDY",   index:0, dir:"I" },
        { label:"D1",    index:1, dir:"I" },
        { label:"GE",    index:2, dir:"I" },
        { label:"RS",    index:3, dir:"I" },
        { label:"D2",    index:4, dir:"I" },
        { label:"TR-IN", index:5, dir:"I" },
        { label:"D3",    index:6, dir:"I" },
        { label:"D4",    index:7, dir:"I" },
    ]},
    { portNo:2, title:"Port 2 – Ausgänge", signals:[
        { label:"RP",      index:0, dir:"O" },
        { label:"RS",      index:1, dir:"O" },
        { label:"POL",     index:2, dir:"O" },
        { label:"Trig",    index:3, dir:"O" },
        { label:"Surge",   index:4, dir:"O" },
        { label:"GE",      index:5, dir:"O" },
        { label:"CDN-EXT", index:6, dir:"O" },
        { label:"ES",      index:7, dir:"O" },
    ]},
    { portNo:3, title:"Port 3 – Ausgänge", signals:[
        { label:"B1M",  index:0, dir:"O" },
        { label:"-",    index:1, dir:"O" },
        { label:"KCDN", index:2, dir:"O" },
        { label:"KHL3", index:3, dir:"O" },
        { label:"KHL4", index:4, dir:"O" },
        { label:"KCL3", index:5, dir:"O" },
        { label:"KCL4", index:6, dir:"O" },
        { label:"PFS",  index:7, dir:"O" },
    ]},
    { portNo:5, title:"Port 5 – Ausgänge", signals:[
        { label:"K18u", index:0, dir:"O" },
        { label:"K9u",  index:1, dir:"O" },
        { label:"KC0",  index:2, dir:"O" },
        { label:"KHL1", index:3, dir:"O" },
        { label:"KCL2", index:4, dir:"O" },
        { label:"KHL2", index:5, dir:"O" },
        { label:"KCL1", index:6, dir:"O" },
        { label:"C/E",  index:7, dir:"O" },
    ]},
    { portNo:7, title:"Port 7 – Ausgänge", signals:[
        { label:"B1",   index:0, dir:"O" },
        { label:"B2",   index:1, dir:"O" },
        { label:"B3",   index:2, dir:"O" },
        { label:"B4",   index:3, dir:"O" },
        { label:"B0",   index:4, dir:"O" },
        { label:"RES",  index:5, dir:"O" },
        { label:"B/C",  index:6, dir:"O" },
        { label:"P-ON", index:7, dir:"O" },
    ]},
    { portNo:8, title:"Port 8 – Ausgänge", signals:[
        { label:"H1",  index:0, dir:"O" },
        { label:"H2",  index:1, dir:"O" },
        { label:"H3",  index:2, dir:"O" },
        { label:"H4",  index:3, dir:"O" },
        { label:"9u",  index:4, dir:"O" },
        { label:"18u", index:5, dir:"O" },
        { label:"VAR", index:6, dir:"O" },
        { label:"OVP", index:7, dir:"O" },
    ]},
    { portNo:9, title:"Port 9 – Eingänge", signals:[
        { label:"689", index:0, dir:"I" },
        { label:"690", index:1, dir:"I" },
        { label:"691", index:2, dir:"I" },
        { label:"692", index:3, dir:"I" },
        { label:"693", index:4, dir:"I" },
        { label:"694", index:5, dir:"I" },
        { label:"695", index:6, dir:"I" },
        { label:"696", index:7, dir:"I" },
    ]},
];

const gpioState = {};

function buildGpioUI() {
    const container = document.getElementById("gpio-port-container");
    container.innerHTML = "";
    GPIO_PORTS.forEach(portDef => {
        const block = document.createElement("div");
        block.className = "gpio-port-block";
        const title = document.createElement("div");
        title.className = "gpio-port-title";
        title.textContent = portDef.title;
        block.appendChild(title);
        const row = document.createElement("div");
        row.className = "gpio-row";
        portDef.signals.forEach(sig => {
            const key = `${portDef.portNo}:${sig.index}`;
            gpioState[key] = 0;
            const item = document.createElement("div");
            item.className = "gpio-item";
            const led = document.createElement("div");
            led.className = "gpio-led unknown" + (sig.dir === "O" ? " output" : "");
            led.id = `led-${portDef.portNo}-${sig.index}`;
            led.title = `${sig.label} — Port ${portDef.portNo}, Index ${sig.index} (${sig.dir === "O" ? "Ausgang" : "Eingang"})`;
            if (sig.dir === "O") led.onclick = () => gpioToggle(portDef.portNo, sig.index);
            const lbl = document.createElement("div");
            lbl.className = "gpio-label";
            lbl.textContent = sig.label;
            item.appendChild(led);
            item.appendChild(lbl);
            row.appendChild(item);
        });
        block.appendChild(row);
        container.appendChild(block);
    });
}

function setLed(port, index, value) {
    const led = document.getElementById(`led-${port}-${index}`);
    if (!led) return;
    gpioState[`${port}:${index}`] = value;
    led.classList.remove("unknown");
    led.classList.toggle("on",  value === 1);
    led.classList.toggle("off", value === 0);
}

function gpioToggle(port, index) {
    const newVal = gpioState[`${port}:${index}`] === 1 ? 0 : 1;
    gpioSendCommand(`${getGenId()}:GPIOSET:${port}:${index}:${newVal}`)
        .then(() => setLed(port, index, newVal));
}

function gpioAll(value) {
    GPIO_PORTS.forEach(p => p.signals.filter(s => s.dir === "O").forEach(sig => {
        gpioSendCommand(`${getGenId()}:GPIOSET:${p.portNo}:${sig.index}:${value}`)
            .then(() => setLed(p.portNo, sig.index, value));
    }));
}

let gpioPoller = null;
function startGpioPolling() {
    if (gpioPoller) return;
    gpioReadAll();
    gpioPoller = setInterval(gpioReadAll, 500);
}
function stopGpioPolling() {
    if (gpioPoller) { clearInterval(gpioPoller); gpioPoller = null; }
}

function gpioReadAll() {
    const all  = GPIO_PORTS.flatMap(p => p.signals.map(s => ({ port: p.portNo, index: s.index })));
    const cmds = all.map(s => `${getGenId()}:GPIOGET:${s.port}:${s.index}`).join("\n");
    gpioSendCommand(cmds).then(resp => {
        if (!resp) return;
        resp.split(/[\r\n]+/).forEach(line => {
            const p = line.trim().split(":");
            if (p.length >= 5) {
                const port = parseInt(p[2],10), idx = parseInt(p[3],10), val = parseInt(p[4],10);
                if (!isNaN(val)) setLed(port, idx, val);
            }
        });
    });
}

function gpioSendCommand(cmd) {
    return fetch("tcp.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "cmd=" + encodeURIComponent(cmd)
    }).then(r => r.text()).catch(() => "");
}

// GPIO UI beim Laden aufbauen
buildGpioUI();

</script>
</body>
</html>