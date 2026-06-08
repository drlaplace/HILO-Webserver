<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(0);

register_shutdown_function(function() {
    $out = ob_get_clean();
    if (!empty($out) && $out[0] !== '{' && $out[0] !== '[') {
        header("Content-Type: application/json");
        echo json_encode(["error" => "PHP: " . substr(strip_tags($out), 0, 300)]);
    } else {
        echo $out;
    }
});

session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(403);
    echo json_encode(["error" => "Nicht autorisiert"]);
    exit;
}

define('INI_FILE', '/123/hilo.ini');
define('PFN_ID', 9);

function readIniRaw() {
    if (!file_exists(INI_FILE)) return null;
    $lines = file(INI_FILE, FILE_IGNORE_NEW_LINES);
    $data = []; $section = null;
    foreach ($lines as $line) {
        $line = rtrim($line);
        if (preg_match('/^\[(.+)\]$/', $line, $m)) {
            $section = $m[1];
            $data[$section] = [];
        } elseif ($section !== null && strpos($line, '=') !== false) {
            [$key, $val] = explode('=', $line, 2);
            $data[$section][trim($key)] = trim($val);
        }
    }
    return $data;
}

function writeIniRaw(array $data) {
    $out = '';
    foreach ($data as $section => $keys) {
        $out .= "[$section]\r\n";
        foreach ($keys as $key => $val) {
            $out .= "$key=$val\r\n";
        }
        $out .= "\r\n";
    }
    $result = file_put_contents(INI_FILE, $out);
    if ($result === false) {
        $err = error_get_last();
        return $err ? $err['message'] : 'file_put_contents failed';
    }
    return true;
}

function sectionName(int $idx): string {
    return 'V_Control%20' . PFN_ID . '%20' . $idx;
}

// ── GET ───────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $idx     = isset($_GET['table']) ? (int)$_GET['table'] : 0;
    $section = sectionName($idx);
    $data    = readIniRaw();

    if ($data === null) {
        echo json_encode(["error" => "INI nicht gefunden: " . INI_FILE]); exit;
    }
    if (!isset($data[$section])) {
        echo json_encode(["VControll"=>100,"VControllneg"=>100,
            "pos"=>array_fill(0,10,0),"neg"=>array_fill(0,10,0)]); exit;
    }
    $sec = $data[$section];
    $res = [
        "VControll"    => isset($sec['VControll'])    ? (int)$sec['VControll']    : 100,
        "VControllneg" => isset($sec['VControllneg']) ? (int)$sec['VControllneg'] : 100,
        "pos" => [], "neg" => [], "sections" => []
    ];
    for ($i = 1; $i <= 10; $i++) {
        $res['pos'][]      = isset($sec["Voff$i"])      ? (int)$sec["Voff$i"]      : 0;
        $res['neg'][]      = isset($sec["Voff{$i}neg"]) ? (int)$sec["Voff{$i}neg"] : 0;
        $res['sections'][] = isset($sec["Section$i"])   ? (int)$sec["Section$i"]   : 0;
    }
    echo json_encode($res); exit;
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        echo json_encode(["error" => "Kein gültiges JSON empfangen"]); exit;
    }
    if (!file_exists(INI_FILE)) {
        echo json_encode(["error" => "INI nicht gefunden: " . INI_FILE]); exit;
    }
    if (!is_writable(INI_FILE)) {
        echo json_encode(["error" => "INI nicht schreibbar: " . INI_FILE]); exit;
    }

    $idx      = isset($body['table'])        ? (int)$body['table']        : 0;
    $vC       = isset($body['VControll'])    ? (int)$body['VControll']    : 100;
    $vCn      = isset($body['VControllneg']) ? (int)$body['VControllneg'] : 100;
    $pos      = (isset($body['pos'])      && is_array($body['pos']))      ? $body['pos']      : array_fill(0,10,0);
    $neg      = (isset($body['neg'])      && is_array($body['neg']))      ? $body['neg']      : array_fill(0,10,0);
    $sections = (isset($body['sections']) && is_array($body['sections'])) ? $body['sections'] : array_fill(0,10,0);

    $section = sectionName($idx);
    $data    = readIniRaw();
    if (!isset($data[$section])) $data[$section] = [];

    $data[$section]['VControll']    = $vC;
    $data[$section]['VControllneg'] = $vCn;
    for ($i = 1; $i <= 10; $i++) {
        $sv = isset($sections[$i-1]) ? (int)$sections[$i-1] : 0;
        if ($sv > 0) $data[$section]["Section$i"] = $sv;
        $data[$section]["Voff$i"]      = isset($pos[$i-1]) ? (int)$pos[$i-1] : 0;
        $data[$section]["Voff{$i}neg"] = isset($neg[$i-1]) ? (int)$neg[$i-1] : 0;
    }

    $r = writeIniRaw($data);
    echo json_encode($r === true ? ["success" => true] : ["error" => "Schreiben: $r"]);
    exit;
}

echo json_encode(["error" => "Methode nicht erlaubt: " . $_SERVER['REQUEST_METHOD']]);