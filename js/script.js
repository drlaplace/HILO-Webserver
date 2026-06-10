let generatorId     = null;
let generatorName   = "Unbekannt";
let monitorInterval = null;
let ustep           = 1;
let maxVoltage      = 12000;
let genConfig       = null;
let globalConfig    = null;   // komplette config.json (für cdnList)
let debugMode       = true;

// Monitor-Definitionen: label, unit, suffix für Anzeige
const MONITOR_META = {
    U:      { label: "U",      unit: "V",  barId: "bar-U" },
    Upeak:  { label: "Upeak",  unit: "V",  barId: null },
    Ipeak:  { label: "Charge", unit: "µC", barId: null },
    Pulse:  { label: "Pulse",  unit: "",   barId: null },
    Rdy:    { label: "Rdy",    unit: "",   barId: null }
};

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

        loadDefaults();
    });
}

// ── Config laden ──────────────────────────────────────────────────────────────
function loadDefaults() {
    fetch("config.json?ts=" + Date.now())
        .then(res => res.json())
        .then(config => {
            globalConfig  = config;
            genConfig     = config.generators[String(generatorId)] || config.fallback;
            generatorName = genConfig.name || "Unbekannt";

            localStorage.setItem("generatorId", generatorId);
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
}

// ── Monitor-Felder aufbauen ───────────────────────────────────────────────────
function buildMonitorFields(monitorList) {
    const container = document.getElementById("monitor-fields");
    container.innerHTML = "";

    monitorList.forEach(key => {
        const meta = MONITOR_META[key];
        if (!meta) return;

        const div = document.createElement("div");
        div.className = "monitor-row";
        div.id = `mon-row-${key}`;

        if (key === "U") {
            div.innerHTML = `
                U: <span id="mon-U">-</span>
                <div style="position:relative;width:100%;height:20px;background:#ddd;border-radius:4px;margin:4px 0;">
                    <div id="bar-U" style="position:absolute;top:0;left:0;height:100%;width:0%;background:#4caf50;border-radius:4px;"></div>
                </div>`;
        } else {
            div.innerHTML = `${meta.label}: <span id="mon-${key}">-</span>${meta.unit ? ' ' + meta.unit : ''}<br>`;
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
    sendCommand(`${generatorId}:Parameter:${genConfig.type}:CDN:${cdnIndex}`).then(showOutput);
}

// ── Koppelnetzwerk anwenden ───────────────────────────────────────────────────
function applyCouplingNetwork(networkKey) {
    const networks = genConfig.couplingNetworks || {};
    const net      = networks[networkKey] || networks["default"] || null;
    if (!net) return;
    fillSelect("coupling",  (net.coupling  || {}).options || [], (net.coupling  || {}).default || "");
    fillSelect("impedance", (net.impedance || {}).options || [], (net.impedance || {}).default || "");
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
        const type   = genConfig ? genConfig.type : "IPG";
        const polMap = { "+": 0, "-": 1, "+/-": 2 };

        genConfig.parameters.forEach(p => {
            const el = document.getElementById(p.id);
            if (!el) return;
            const cmdKey = p.cmd || p.id;
            let val = el.value;
            if (p.id === "polarity") val = polMap[val] ?? 0;
            sendCommand(`${generatorId}:Parameter:${type}:${cmdKey}:${val}`);
        });

        if (genConfig.supportsCoupling) {
            const cdnEl      = document.getElementById("cdn");
            const couplingEl = document.getElementById("coupling");
            const impedanceEl= document.getElementById("impedance");
            if (cdnEl)       sendCommand(`${generatorId}:Parameter:${type}:CDN:${cdnEl.value}`);
            if (couplingEl)  sendCommand(`${generatorId}:Parameter:${type}:Coupling:${couplingEl.value}`);
            if (impedanceEl) sendCommand(`${generatorId}:Parameter:${type}:Impedance:${impedanceEl.value}`);
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
    const el = document.getElementById("output");
    if (el) el.textContent = text;
}

// ── Monitoring ────────────────────────────────────────────────────────────────
function startMonitoring() {
    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(fetchMonitorValues, 20);
    fetchMonitorValues();
}

function stopMonitoring() {
    if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}

function fetchMonitorValues() {
    if (!generatorId || !genConfig) return;

    const activeMonitors = genConfig.monitor || ["U", "Upeak", "Ipeak", "Pulse", "Rdy"];
    const monitorCmd = activeMonitors
        .map(k => `${generatorId}:Monitor:${k}`)
        .join("\n");

    sendCommand(monitorCmd).then(response => {
        if (!response) return;

        const monitorData = {};
        response.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).forEach(line => {
            const parts = line.split(":").map(p => p.trim());
            if (parts.length >= 4) monitorData[parts[2]] = parseInt(parts[3], 10);
        });

        // U mit Balken
        if ("U" in monitorData && document.getElementById("mon-U")) {
            const scaledU = monitorData["U"] * ustep;
            document.getElementById("mon-U").textContent = scaledU + " V";
            const barU = document.getElementById("bar-U");
            if (barU) barU.style.width = Math.min((scaledU / maxVoltage) * 100, 100) + "%";
        }

        // Alle anderen aktiven Monitor-Werte
        ["Upeak", "Ipeak", "Pulse", "Rdy"].forEach(key => {
            if (key in monitorData) {
                const el = document.getElementById(`mon-${key}`);
                if (el) el.textContent = monitorData[key];
            }
        });

        // Eval-Box (nur wenn ixtlimit und Rdy vorhanden)
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

        // Auto-Stop
        const pulsesEl = document.getElementById("pulses");
        if (pulsesEl && "Pulse" in monitorData && "Rdy" in monitorData) {
            if (monitorData["Pulse"] >= parseInt(pulsesEl.value, 10) && monitorData["Rdy"] === 1) {
                sendCommand(`${generatorId}:Control:Stop`).then(showOutput);
                stopMonitoring();
            }
        }
    });
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