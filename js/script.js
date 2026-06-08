let generatorId = null;
let generatorName = "Unbekannt";
let monitorInterval = null;
let ustep = 1; // Standard, falls JSON keinen Wert hat
let maxVoltage = 12000; 
let debugMode = true; // Debug-Modus hier umschalten

const names = {
    60: "IPG605",
    61: "IPG1012",
    62: "IPG1218",
    63: "IPG2025",
    64: "IPG2436"
};

document.addEventListener("DOMContentLoaded", () => {
    init();

    document.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => handleAction(btn.dataset.action));
    });

    // Start, Pause, Stop initial deaktivieren
    setRunButtonsEnabled(false);
});

function setRunButtonsEnabled(enabled) {
    ["Start", "Pause", "Stop"].forEach(action => {
        const btn = document.querySelector(`button[data-action="${action}"]`);
        if (btn) {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? "1" : "0.4";
            btn.style.cursor = enabled ? "pointer" : "not-allowed";
        }
    });
}

function init() {
    sendCommand("0:Control").then(response => {
        if (!response) return;
        const parts = response.split(":");
        generatorId = parseInt(parts[0]);
        generatorName = names[generatorId] || "Unbekannt";
        localStorage.setItem("generatorId", generatorId); // für protected.php
        document.getElementById("gen-name").textContent = generatorName;
                      // Pulse & Rdy nur anzeigen, wenn Debug aktiviert
        if (!debugMode) {
            // document.getElementById("mon-Pulse-line").style.display = "none";
            document.getElementById("mon-Rdy-line").style.display = "none";
            document.getElementById("output-box").style.display = "none";
        }
        else {
            // document.getElementById("mon-Pulse-line").style.display = "block";
            document.getElementById("mon-Rdy-line").style.display = "block";
            document.getElementById("output-box").style.display = "block";
        }

        loadDefaults();
    });
}

function loadDefaults() {
    fetch("config.json?ts=" + Date.now())
        .then(res => res.json())
        .then(config => {
            // Generator-ID als String für JSON-Zugriff
            let genConfig = config.generators[String(generatorId)];
            console.log(genConfig);
            console.log(genConfig.voltage);
            console.log(genConfig.voltage.min);
            console.log(genConfig.voltage.max);
            if (!genConfig) return;
            document.getElementById("pulses").value = genConfig.pulses.default;
            document.getElementById("voltage").value = genConfig.voltage.default;
            document.getElementById("reptime").value = genConfig.reptime.default;
            document.getElementById("ixtlimit").value = genConfig.ixtlimit.default;
            document.getElementById("tdelay").value = genConfig.tdelay.default;
            document.getElementById("polarity").value = genConfig.polarity.default;

            // 🔹 ustep immer übernehmen
            ustep = parseFloat(genConfig.ustep);
            maxVoltage = parseInt(genConfig.voltage.max, 10);  // 🔹 Max Voltage als Integer

            setupValidation("pulses", genConfig.pulses);
            setupValidation("voltage", genConfig.voltage);
            setupValidation("reptime", genConfig.reptime);
            setupValidation("ixtlimit", genConfig.ixtlimit);
            setupValidation("tdelay", genConfig.tdelay);

        });
}

function setupValidation(id, cfg) {

    const input = document.getElementById(id);

    // HTML Grenzen setzen
    input.min = cfg.min;
    input.max = cfg.max;

    // Minus und e verhindern
    input.addEventListener("keydown", function(e) {

        if (e.key === "-" || e.key === "e" || e.key === "E") {
            e.preventDefault();
        }
    });

    // Paste verhindern
    input.addEventListener("paste", function(e) {

        let text = (e.clipboardData || window.clipboardData).getData("text");

        if (text.includes("-")) {
            e.preventDefault();
        }
    });

    // // JEDEN Wert hart korrigieren
    // input.addEventListener("input", function() {

    //     // Alles außer Zahlen/Punkt entfernen
    //     input.value = input.value.replace(/[^0-9.]/g, "");

    //     let val = parseFloat(input.value);

    //     if (isNaN(val)) {
    //         input.value = cfg.min;
    //         return;
    //     }

    //     // Unter Minimum
    //     if (val < cfg.min) {
    //         input.value = cfg.min;
    //     }

    //     // Über Maximum
    //     if (val > cfg.max) {
    //         input.value = cfg.max;
    //     }
    // });

    // Beim Verlassen nochmals prüfen
    input.addEventListener("blur", function() {

        let val = parseFloat(input.value);

        if (isNaN(val) || val < cfg.min) {
            input.value = cfg.min;
        }

        if (val > cfg.max) {
            input.value = cfg.max;
        }
    });
}

function handleAction(action) {
    if (!generatorId) return;

    if (action === "On") {
        setRunButtonsEnabled(true);
    } else if (action === "Off") {
        setRunButtonsEnabled(false);
        stopMonitoring();
    }

    if (action === "Start") {
        const pulses = document.getElementById("pulses").value;
        const voltage = document.getElementById("voltage").value;
        const reptime = document.getElementById("reptime").value;
        const tdelay = document.getElementById("tdelay").value;
        const ixtlimit = document.getElementById("ixtlimit").value;
        const polarity = document.getElementById("polarity").value;
        const polMap = { "+": 0, "-": 1, "+/-": 2 };
        const polVal = polMap[polarity];

        sendCommand(`${generatorId}:Parameter:IPG:PulsNo:${pulses}`);
        sendCommand(`${generatorId}:Parameter:IPG:Voltage:${voltage}`);
        sendCommand(`${generatorId}:Parameter:IPG:RepTime:${reptime}`);
        sendCommand(`${generatorId}:Parameter:IPG:TDelay:${tdelay}`);
        sendCommand(`${generatorId}:Parameter:IPG:IxtLimit:${ixtlimit}`);
        sendCommand(`${generatorId}:Parameter:IPG:Pol:${polVal}`);

        startMonitoring();
    }
    sendCommand(`${generatorId}:Control:${action}`).then(showOutput);

    if (action === "Stop") {
        stopMonitoring();
    }
}

function sendCommand(cmd) {
    // console.log("Sende:", cmd);
    return fetch("tcp.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "cmd=" + encodeURIComponent(cmd)
    })
    .then(res => res.text())
    .then(text => {
        // console.log("Empfangen:", text);
        return text;
    });
}

function showOutput(text) {
    document.getElementById("output").textContent = text;
}

function startMonitoring() {
    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(fetchMonitorValues, 20); // alle 500ms
    fetchMonitorValues(); // sofort erste Abfrage
}

function stopMonitoring() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}

function fetchMonitorValues() {
    if (!generatorId) return;

    // Alle Monitorbefehle in EINEM String mit \\n trennen
    const monitorCmd = [
        `${generatorId}:Monitor:U`,
        `${generatorId}:Monitor:Upeak`,
        `${generatorId}:Monitor:Ipeak`,
        `${generatorId}:Monitor:Pulse`,
        `${generatorId}:Monitor:Rdy`
    ].join("\n");

    sendCommand(monitorCmd).then(response => {
        if (!response) return;

        const rawLines = response.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
        let monitorData = {};

        rawLines.forEach(line => {
            const parts = line.split(":").map(p => p.trim());
            if (parts.length >= 4) {
                monitorData[parts[2]] = parseInt(parts[3], 10);
            }
        });

        // 🔹 U mit ustep multiplizieren
        if ("U" in monitorData) {
            const scaledU = (monitorData["U"] * ustep);
            document.getElementById("mon-U").textContent = scaledU + " V";

            let percent = Math.min((scaledU / maxVoltage) * 100, 100);
            document.getElementById("bar-U").style.width = percent + "%";
        }
        if ("Upeak" in monitorData) document.getElementById("mon-Upeak").textContent = monitorData["Upeak"] + " V";
        if ("Ipeak" in monitorData) document.getElementById("mon-Ipeak").textContent = monitorData["Ipeak"] + " µC";
        if ("Pulse" in monitorData) document.getElementById("mon-Pulse").textContent = monitorData["Pulse"];
        if ("Rdy" in monitorData) document.getElementById("mon-Rdy").textContent = monitorData["Rdy"];

        // if ("Ipeak" in monitorData && "Rdy" in monitorData) {
            const ipeak = monitorData["Ipeak"];
            const rdy = monitorData["Rdy"];
            const ixtLimit = parseFloat(document.getElementById("ixtlimit").value);
            console.log("Ipeak:", ipeak, "Rdy:", rdy, "IxtLimit:", ixtLimit);
            if (rdy === 1) {
                if (ipeak < ixtLimit) {
                    document.getElementById("eval-box").textContent = "PASS";
                    document.getElementById("eval-box").style.color = "green";
                } else {
                    document.getElementById("eval-box").textContent = "FAIL";
                    document.getElementById("eval-box").style.color = "red";
                }
            } else {
                document.getElementById("eval-box").textContent = "WAIT";
                document.getElementById("eval-box").style.color = "black";
            }
        // }


        // Auto-Stop prüfen
        const pulsesSet = parseInt(document.getElementById("pulses").value, 10);
        if (monitorData["Pulse"] >= pulsesSet && monitorData["Rdy"] === 1) {
            sendCommand(`${generatorId}:Control:Stop`).then(showOutput);
            stopMonitoring();
        }
    });
}