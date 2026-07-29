let generatorId     = null;
let generatorName   = "Unbekannt";
let monitorInterval = null;
let ustep           = 1;
let maxVoltage      = 12000;
let sliderLimits    = [];     // sliderLimits[i] = (i+1)/10 * maxVoltage
let pulses          = 0;
let genConfig       = null;
let globalConfig    = null;   // komplette config.json (für cdnList)
let isMultiDevice   = false;  // Kombigerät-Modus
let activeModuleIdx = 0;      // aktiver Modul-Tab-Index
let debugMode       = true;

document.addEventListener("DOMContentLoaded", () => {
    init();
    document.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => handleAction(btn.dataset.action));
    });
    setRunButtonsEnabled(false);
});

// ── Buttons ───────────────────────────────────────────────────────────────────
function setRunButtonsEnabled(enabled) {
    ["Start", "Pause", "Stop"].forEach(action => {
        const btn = document.querySelector(`button[data-action="${action}"]`);
        if (btn) {
            btn.disabled      = !enabled;
            btn.style.opacity = enabled ? "1" : "0.4";
            btn.style.cursor  = enabled ? "pointer" : "not-allowed";
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
    sendCommand("0:Control").then(response => {
        if (!response) return;
        generatorId = parseInt(response.split(":")[0]);

        if (!debugMode) {
            document.getElementById("output-box").style.display = "none";
        }
        if (generatorId != 9) {
            document.getElementById("eval-box").style.display = "none";
        }

        loadDefaults();

    });
}

// ── Config laden ──────────────────────────────────────────────────────────────
function loadDefaults() {
    fetch("config.json?ts=" + Date.now())
        .then(res => res.json())
        .then(config => {
            globalConfig  = config;
            localStorage.setItem("generatorId", generatorId);

            // Multi-Device Modus prüfen (generatorId 1 oder 2 → immer Multi)
            const md = config.multiDevices && config.multiDevices[String(generatorId)];
            if (md) {
                isMultiDevice = true;
                document.getElementById("gen-name").textContent = md.name;
                buildModuleTabs(md, config);
                // Ersten enabled Tab aktivieren
                const firstIdx = md.modules.findIndex(m => m.enabled);
                loadModule(md, config, firstIdx >= 0 ? firstIdx : 0);
                return;
            }

            // Einzelgerät
            isMultiDevice = false;
            genConfig     = config.generators[String(generatorId)] || config.fallback;
            generatorName = genConfig.name || "Unbekannt";
            localStorage.setItem("pfnId", genConfig.pfnId || 9);
            document.getElementById("gen-name").textContent = generatorName;
            ustep      = parseFloat(genConfig.ustep);
            maxVoltage = (getParamCfg("voltage") || {}).max || 12000;

            buildParamFields(genConfig.parameters);
            buildMonitorFields(genConfig.monitor || ["U", "Upeak", "Ipeak", "Pulse", "Rdy"]);

            // Coupling
            const couplingSection = document.getElementById("coupling-section");
            if (genConfig.supportsCoupling) {
                couplingSection.style.display = "block";
                buildCdnSelect();
                applyCouplingNetwork("default");
            } else {
                couplingSection.style.display = "none";
            }
        });
}

// ── Parameter-Felder aufbauen ─────────────────────────────────────────────────
function buildParamFields(parameters) {
    const container = document.getElementById("param-fields");
    container.innerHTML = "";
    parameters.forEach(p => {
        const row = document.createElement("div");
        row.className = "param-row";
        row.id = `row-${p.id}`;

        const labelEl = document.createElement("span");
        labelEl.className   = "param-label";
        labelEl.textContent = p.label + (p.unit ? ` [${p.unit}]` : "") + ":";

        let input;
        if (p.type === "select") {
            input = document.createElement("select");
            (p.options || []).forEach(opt => {
                const o = document.createElement("option");
                o.value = opt; o.textContent = opt;
                if (opt === p.default) o.selected = true;
                input.appendChild(o);
            });
        } else {
            input = document.createElement("input");
            input.type      = "number";
            input.inputMode = "numeric";
            input.min       = p.min;
            input.max       = p.max;
            input.value     = p.default;
            setupValidation(input, p);
        }
        input.id = p.id;

        const unitEl = document.createElement("span");
        unitEl.className = "param-unit";

        row.appendChild(labelEl);
        row.appendChild(input);
        row.appendChild(unitEl);
        container.appendChild(row);
    });

    // Countdown-Anzeige initialisieren (reptime oder testtime)
    const cdParamId = (genConfig && genConfig.countdownParam) || "reptime";
    const cdInitEl  = document.getElementById(cdParamId);
    if (cdInitEl) {
        const el = document.getElementById("countdown-box");
        if (el) el.textContent = String(Math.ceil(parseFloat(cdInitEl.value) || 0));
        const lbl = document.getElementById("countdown-label");
        if (lbl) lbl.textContent = cdParamId === "testtime" ? "Test Time" : "Rep. Time";
    }
}

// ── Monitor-Felder aufbauen — aus Config-Objekten {id, label, unit, bar} ─────
function buildMonitorFields(monitorList) {
    const container = document.getElementById("monitor-fields");
    container.innerHTML = "";

    monitorList.forEach(m => {
        const div = document.createElement("div");
        div.className = "monitor-row";
        div.id = `mon-row-${m.id}`;

        if (m.bar) {
            div.innerHTML = `
                ${m.label}: <span id="mon-${m.id}">-</span>
                <div style="position:relative;width:100%;height:20px;background:#ddd;border-radius:4px;margin:4px 0;">
                    <div id="bar-${m.id}" style="position:absolute;top:0;left:0;height:100%;width:0%;background:#4caf50;border-radius:4px;"></div>
                </div>`;
        } else {
            div.innerHTML = `${m.label}: <span id="mon-${m.id}">-</span><br>`;
        }
        container.appendChild(div);
    });
}

// ── CDN-Select aufbauen — nur im Generator definierte Netzwerke ──────────────
function buildCdnSelect() {
    const sel      = document.getElementById("cdn");
    const networks = genConfig.couplingNetworks || {};
    sel.innerHTML  = "";
    Object.entries(networks).forEach(([key, net]) => {
        const o = document.createElement("option");
        // value = cdnIndex falls vorhanden, sonst key
        o.value       = net.cdnIndex !== undefined ? net.cdnIndex : key;
        o.textContent = net.name || key;
        sel.appendChild(o);
    });
}

// ── CDN-Auswahl geändert ──────────────────────────────────────────────────────
function onCdnChange() {
    const cdnIndex = parseInt(document.getElementById("cdn").value, 10);
    // CDN-Index → passendes couplingNetwork suchen
    // Konvention: couplingNetworks-Key kann "CDN_<index>" sein, sonst "default"
    const networks = genConfig.couplingNetworks || {};
    const netKey   = Object.keys(networks).find(k => {
        // Prüfe ob der Key einen Index-Kommentar hat oder direkt per Index gemappt ist
        const net = networks[k];
        return net.cdnIndex === cdnIndex;
    }) || "default";

    applyCouplingNetwork(netKey);

    // CDN-Befehl an Generator senden
    sendCommand(`${generatorId}:Parameter:${genConfig.subUnit || genConfig.type || 'IPG'}:CDN:${cdnIndex}`).then(showOutput);
}

// ── Koppelnetzwerk anwenden ───────────────────────────────────────────────────
function applyCouplingNetwork(networkKey) {
    const networks = genConfig.couplingNetworks || {};
    const net      = networks[networkKey] || networks["default"] || null;
    if (!net) return;

    if (net.couplingType === "bitmask") {
        buildCouplingCheckboxes(net.coupling);
    } else {
        // Standard Select
        const container = document.getElementById("coupling-container");
        if (container) {
            container.innerHTML = '<select id="coupling"></select>';
        }
        fillSelect("coupling", (net.coupling || {}).options || [], (net.coupling || {}).default || "");
    }
    fillSelect("impedance", (net.impedance || {}).options || [], (net.impedance || {}).default || "");
}

function buildCouplingCheckboxes(couplingCfg) {
    const container = document.getElementById("coupling-container");
    if (!container) return;
    const lines    = couplingCfg.lines   || [];
    const defaults = couplingCfg.default || [];
    const div = document.createElement("div");
    div.className = "coupling-checkboxes";
    div.id = "coupling-checkboxes";
    lines.forEach((line, idx) => {
        const lbl = document.createElement("label");
        const cb  = document.createElement("input");
        cb.type   = "checkbox";
        cb.value  = line;
        cb.id     = `coupling-cb-${line}`;
        cb.checked = defaults.includes(line);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(line));
        div.appendChild(lbl);
    });
    container.innerHTML = "";
    container.appendChild(div);
}

function getEftCouplingValue() {
    // Berechne Bitwert aus aktivierten Checkboxen
    const net = (() => {
        const networks = genConfig.couplingNetworks || {};
        const cdnEl = document.getElementById("cdn");
        if (!cdnEl) return networks["default"] || null;
        const cdnIdx = parseInt(cdnEl.value, 10);
        return Object.values(networks).find(n => n.cdnIndex === cdnIdx) || networks["default"];
    })();
    if (!net || net.couplingType !== "bitmask") return null;

    const lines = (net.coupling || {}).lines || [];
    const bits  = (net.coupling || {}).bits  || [];
    let value = 0;
    lines.forEach((line, i) => {
        const cb = document.getElementById(`coupling-cb-${line}`);
        if (cb && cb.checked) value += (bits[i] || 0);
    });
    return value;
}

function fillSelect(id, options, defaultVal) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt; o.textContent = opt;
        if (opt === defaultVal) o.selected = true;
        sel.appendChild(o);
    });
}

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────
function getParamCfg(id) {
    if (!genConfig || !genConfig.parameters) return null;
    return genConfig.parameters.find(p => p.id === id) || null;
}

// ── CWG Coupling → Zahlenwert (Manual S.20) ──────────────────────────────────
// Format: <HV-Bits><COM-Code(2-stellig)>
// HV-Bits: L1=1024,L2=512,L3=256,L4=128,L5=64,L6=32,L7=16,L8=8,N=4,PE=2,HV=1
// COM-Code: HV=00,L1=01,L2=02,L3=03,N=09,PE=11
const CWG_HV_BITS  = { L1:1024, L2:512, L3:256, L4:128, L5:64, L6:32, L7:16, L8:8, N:4, PE:2, HV:1 };
const CWG_COM_CODE = { "HV-OUT":"00", L1:"01", L2:"02", L3:"03", L4:"04", L5:"05", L6:"06", L7:"07", L8:"08", N:"09", PE:"11" };

function cwgCouplingValue(couplingStr) {
    // "HV-OUT" → 100 (HV=1, COM=00)
    // "L->N"   → 409 (L=4, COM=09... wait, L=N-side=4? No.)
    // Notation: "A->B" means HV=A, COM=B
    // Special: "HV-OUT" = HV=1, COM=00
    if (couplingStr === "HV-OUT") return 100;

    const parts = couplingStr.split("->"); // ["L1","PE"] or ["L","N"]
    if (parts.length !== 2) return 100;

    // Normalize single-letter to match table
    const hvKey  = parts[0].trim(); // e.g. "L1", "N", "L"
    const comKey = parts[1].trim(); // e.g. "PE", "N"

    const hvBit  = CWG_HV_BITS[hvKey]   ?? CWG_HV_BITS["HV"] ?? 1;
    const comCode= CWG_COM_CODE[comKey] ?? "00";

    // Value = hvBit * 100 + comCode (as number)
    return parseInt(String(hvBit) + comCode, 10);
}

// ── CWG Impedance → Zahlenwert (Manual S.21) ─────────────────────────────────
const CWG_IMPEDANCE = {
    "None":       0,
    "VAR":        1,
    "18µ":        18,
    "9µ+10Ω":     9,
    "0,1µ+40Ω":  401,
    "0,5µ+40Ω":  405,
    "0,1µ+500Ω": 5001,
    "0,5µ+500Ω": 5005,
};

function cwgImpedanceValue(impedanceStr) {
    return CWG_IMPEDANCE[impedanceStr] ?? 0;
}

// ── Aktion ausführen ──────────────────────────────────────────────────────────
function handleAction(action) {
    if (!generatorId) return;

    if (action === "On") {
        setRunButtonsEnabled(true);
    } else if (action === "Off") {
        setRunButtonsEnabled(false);
        stopMonitoring();
    }

    if (action === "Start") {
        const subUnit = genConfig ? (genConfig.subUnit || genConfig.type || "IPG") : "IPG";

        pulses = 0; // Reset pulses count on start
        // Wert-Mapping für bestimmte Select-Parameter
        const VALUE_MAP = {
            polarity: { "+": 0, "-": 1, "+/-": 2 },
            output:   { "EUT": 1, "Clamp": 0 }
        };

        genConfig.parameters.forEach(p => {
            const el = document.getElementById(p.id);
            if (!el) return;
            const cmdKey = p.cmd || p.id;
            let val = el.value;
            if (VALUE_MAP[p.id]) val = VALUE_MAP[p.id][val] ?? val;
            sendCommand(`${generatorId}:Parameter:${subUnit}:${cmdKey}:${val}`);
        });

        if (genConfig.supportsCoupling) {
            const cdnEl       = document.getElementById("cdn");
            const impedanceEl = document.getElementById("impedance");
            if (cdnEl) sendCommand(`${generatorId}:Parameter:${subUnit}:CDN:${cdnEl.value}`);

            // Coupling: bitmask (EFT) oder CWG-Codierung
            const networks  = genConfig.couplingNetworks || {};
            const cdnIdx    = cdnEl ? parseInt(cdnEl.value, 10) : 0;
            const activeNet = Object.values(networks).find(n => n.cdnIndex === cdnIdx) || networks["default"];
            if (activeNet && activeNet.couplingType === "bitmask") {
                const bitVal = getEftCouplingValue();
                if (bitVal !== null) sendCommand(`${generatorId}:Parameter:${subUnit}:Coupling:${bitVal}`);
            } else {
                const couplingEl = document.getElementById("coupling");
                if (couplingEl) sendCommand(`${generatorId}:Parameter:${subUnit}:Coupling:${cwgCouplingValue(couplingEl.value)}`);
            }
            if (impedanceEl) sendCommand(`${generatorId}:Parameter:${subUnit}:Impedance:${cwgImpedanceValue(impedanceEl.value)}`);
        }

        startMonitoring();
    }

    sendCommand(`${generatorId}:Control:${action}`).then(showOutput);

    if (action === "Stop") stopMonitoring();
}

// ── TCP ───────────────────────────────────────────────────────────────────────
function sendCommand(cmd) {
    return fetch("tcp.php", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    "cmd=" + encodeURIComponent(cmd)
    }).then(res => res.text());
}

function showOutput(text) {
    const el = document.getElementById("output-text");
    if (el) el.textContent = text;
}

// ── Monitoring ────────────────────────────────────────────────────────────────
function startMonitoring() {
    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(fetchMonitorValues, 20);
    fetchMonitorValues();
    // Countdown starten — reptime oder testtime je nach Generator
    const cdParam   = (genConfig && genConfig.countdownParam) || "reptime";
    const cdEl      = document.getElementById(cdParam);
    const cdSeconds = cdEl ? (parseFloat(cdEl.value) || 0) : 0;
    const cdRepeat  = cdParam !== "testtime";
    startCountdown(cdSeconds, cdRepeat);
    const cdLabel = document.getElementById("countdown-label");
    if (cdLabel) cdLabel.textContent = cdParam === "testtime" ? "Test Time" : "Rep. Time";
}

function stopMonitoring() {
    if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
    stopCountdown();
}

function fetchMonitorValues() {
    if (!generatorId || !genConfig) return;

    const monitorList = genConfig.monitor || [];
    const monitorCmd  = monitorList
        .map(m => `${generatorId}:Monitor:${m.id}`)
        .join("\n");

    sendCommand(monitorCmd).then(response => {
        if (!response) return;

        const monitorData = {};
        response.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).forEach(line => {
            const parts = line.split(":").map(p => p.trim());
            if (parts.length >= 4) monitorData[parts[2]] = parseInt(parts[3], 10);
        });

        // Alle Monitor-Felder aus Config aktualisieren
        monitorList.forEach(m => {
            if (!(m.id in monitorData)) return;
            const el = document.getElementById(`mon-${m.id}`);
            if (!el) return;

            // U-Kanal: mit ustep skalieren
            const val = m.id === "U"
                ? monitorData[m.id] * ustep
                : monitorData[m.id];

            el.textContent = val + (m.unit ? ' ' + m.unit : '');

            // Balken aktualisieren falls vorhanden
            if (m.bar) {
                const bar = document.getElementById(`bar-${m.id}`);
                if (bar) bar.style.width = Math.min((val / maxVoltage) * 100, 100) + "%";
            }
        });

        // Eval-Box (nur wenn ixtlimit und Rdy + Ipeak vorhanden)
        const ixtEl = document.getElementById("ixtlimit");
        if (ixtEl && "Rdy" in monitorData && "Ipeak" in monitorData) {
            const rdy      = monitorData["Rdy"];
            const ipeak    = monitorData["Ipeak"];
            const ixtLimit = parseFloat(ixtEl.value);
            const evalBox  = document.getElementById("eval-box");
            if (rdy === 1) {
                evalBox.textContent = ipeak < ixtLimit ? "PASS" : "FAIL";
                evalBox.style.color = ipeak < ixtLimit ? "green" : "red";
            } else {
                evalBox.textContent = "WAIT";
                evalBox.style.color = "black";
            }
        }

        //Rep Time wieder zurücksetzen, falls Pulszahl erhöht wurde
        const pulsesEl = document.getElementById("pulses");
        if (pulsesEl && "Pulse" in monitorData){
            if (monitorData["Pulse"] > pulses) {
                console.log("Pulses increased, resetting countdown to reptime", monitorData["Pulse"], pulses);
                startCountdown(parseFloat(document.getElementById("reptime").value) || 0);
                pulses = monitorData["Pulse"];
            }
        }
        // Auto-Stop
        if (pulsesEl && "Pulse" in monitorData && "Rdy" in monitorData) {
            if (monitorData["Pulse"] >= parseInt(pulsesEl.value, 10) && monitorData["Rdy"] === 1) {
                sendCommand(`${generatorId}:Control:Stop`).then(showOutput);
                stopMonitoring();
            }
        }
    });
}


// ── Countdown-Timer ───────────────────────────────────────────────────────────
let countdownInterval = null;
let countdownValue    = 0;

function updateCountdownDisplay(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const seconds = Math.ceil(totalSeconds);
    const el = document.getElementById("countdown-box");
    if (el) el.textContent = String(seconds).padStart(1,'0');
}

let countdownRepeat  = true;
let countdownSeconds = 0;

function startCountdown(seconds, repeat = true) {
    stopCountdown();
    countdownRepeat  = repeat;
    countdownSeconds = seconds;
    countdownValue   = seconds;
    updateCountdownDisplay(countdownValue);
    countdownInterval = setInterval(() => {
        countdownValue -= 0.1;
        if (countdownValue <= 0) {
            if (countdownRepeat) {
                countdownValue = countdownSeconds;
            } else {
                countdownValue = 0;
                updateCountdownDisplay(0);
                stopCountdown();
                // Control:Stop nur bei testtime-Modus
                if (generatorId) sendCommand(`${generatorId}:Control:Stop`).then(showOutput);
                stopMonitoring();
                return;
            }
        }
        updateCountdownDisplay(countdownValue);
    }, 100);
}

function resetCountdown(seconds) {
    if (!countdownRepeat) return; // nur bei reptime-Modus
    countdownValue = seconds;
    updateCountdownDisplay(countdownValue);
}

function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    updateCountdownDisplay(0);
}

// ── Slider-Limits berechnen ──────────────────────────────────────────────────
function buildLimits() {
    sliderLimits = [];
    for (let i = 1; i <= 10; i++)
        sliderLimits.push(Math.round(maxVoltage * i / 10));
}

// ── Multi-Device: Modul-Tabs aufbauen ────────────────────────────────────────
function buildModuleTabs(md, config) {
    let tabBar = document.getElementById("module-tab-bar");
    if (!tabBar) {
        tabBar = document.createElement("div");
        tabBar.id = "module-tab-bar";
        tabBar.style.cssText = "display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;";
        const genName = document.getElementById("gen-name");
        genName.parentNode.insertBefore(tabBar, genName.nextSibling);
    }
    tabBar.innerHTML = "";
    md.modules.forEach((mod, idx) => {
        if (!mod.enabled) return; // nur enabled Module anzeigen
        const btn = document.createElement("button");
        btn.id = `module-tab-btn-${idx}`;
        btn.className = "btn";
        btn.textContent = mod.label;
        btn.onclick = () => loadModule(md, globalConfig, idx);
        tabBar.appendChild(btn);
    });
}

function loadModule(md, config, idx) {
    activeModuleIdx = idx;
    const mod = md.modules[idx];

    // Tab-Buttons hervorheben
    md.modules.forEach((_, i) => {
        const btn = document.getElementById(`module-tab-btn-${i}`);
        if (btn) {
            btn.classList.toggle("active", i === idx);
        }
    });

    // genConfig + pfnId auf Modul setzen
    genConfig = config.generators[mod.generatorRef] || config.fallback;
    localStorage.setItem("pfnId", mod.pfnId);
    document.getElementById("gen-name").textContent = `${md.name} — ${mod.label}`;

    // ustep + maxVoltage
    ustep = parseFloat(genConfig.ustep) || 1;
    const voltParam = (genConfig.parameters || []).find(p => p.id === "voltage");
    maxVoltage = voltParam ? parseInt(voltParam.max, 10) : 12000;
    buildLimits();

    // UI neu aufbauen
    buildParamFields(genConfig.parameters || []);
    buildMonitorFields(genConfig.monitor || []);

    // Coupling
    const couplingSection = document.getElementById("coupling-section");
    if (genConfig.supportsCoupling) {
        couplingSection.style.display = "block";
        buildCdnSelect();
        applyCouplingNetwork("default");
    } else {
        couplingSection.style.display = "none";
    }
}

// ── Validierung ───────────────────────────────────────────────────────────────
function setupValidation(input, cfg) {
    input.addEventListener("keydown", e => {
        if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
    });
    input.addEventListener("paste", e => {
        if ((e.clipboardData || window.clipboardData).getData("text").includes("-")) e.preventDefault();
    });
    input.addEventListener("blur", () => {
        let val = parseFloat(input.value);
        if (isNaN(val) || val < cfg.min) input.value = cfg.min;
        if (val > cfg.max) input.value = cfg.max;
    });
}