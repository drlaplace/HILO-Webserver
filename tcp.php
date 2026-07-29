<?php
session_start();

$host = "127.0.0.1";
$port = 8081;

// Persistente Verbindung pro Session
if (!isset($_SESSION['tcp_socket']) || !is_resource($_SESSION['tcp_socket']) || feof($_SESSION['tcp_socket'])) {
    $socket = @pfsockopen($host, $port, $errno, $errstr, 2);
    if (!$socket) {
        echo "Socket Fehler: $errstr ($errno)";
        exit;
    }
    stream_set_blocking($socket, true);
    $_SESSION['tcp_socket'] = $socket;
} else {
    $socket = $_SESSION['tcp_socket'];
}

if (!isset($_POST['cmd'])) {
    echo "Kein Befehl";
    exit;
}

// 🔹 Flush: alles Alte entfernen
stream_set_blocking($socket, false);
while (fgets($socket, 512) !== false) { /* Puffer leeren */ }
stream_set_blocking($socket, true);

// Befehl senden
$cmd = $_POST['cmd'];
fwrite($socket, $cmd . "\n");

// 🔹 Zuerst blockierend eine Antwortzeile lesen (garantiert ein Startpunkt)
$response = '';
$firstLine = fgets($socket, 512);
if ($firstLine !== false) {
    $response .= $firstLine;
}

// 🔹 Danach non-blocking alle restlichen Zeilen, die sofort da sind, abholen
stream_set_blocking($socket, false);
while (($line = fgets($socket, 512)) !== false) {
    $response .= $line;
}
stream_set_blocking($socket, true);

echo trim($response);
