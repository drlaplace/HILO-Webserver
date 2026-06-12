let generatorId     = null;
let generatorName   = "Unbekannt";
let monitorInterval = null;
let ustep           = 1;
let maxVoltage      = 12000;
let genConfig       = null;
let globalConfig    = null;   // komplette config.json (für cdnList)
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
        const polMap  = { "+": 0, "-": 1, "+/-": 2 };

        genConfig.parameters.forEach(p => {
            const el = document.getElementById(p.id);
            if (!el) return;
            const cmdKey = p.cmd || p.id;
            let val = el.value;
            if (p.id === "polarity") val = polMap[val] ?? 0;
            sendCommand(`${generatorId}:Parameter:${subUnit}:${cmdKey}:${val}`);
        });

        if (genConfig.supportsCoupling) {
            const cdnEl       = document.getElementById("cdn");
            const couplingEl  = document.getElementById("coupling");
            const impedanceEl = document.getElementById("impedance");
            if (cdnEl)        sendCommand(`${generatorId}:Parameter:${subUnit}:CDN:${cdnEl.value}`);
            if (couplingEl)   sendCommand(`${generatorId}:Parameter:${subUnit}:Coupling:${cwgCouplingValue(couplingEl.value)}`);
            if (impedanceEl)  sendCommand(`${generatorId}:Parameter:${subUnit}:Impedance:${cwgImpedanceValue(impedanceEl.value)}`);
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