<?php
session_start();

$valid_user = 'admin';
$valid_hash = '$2y$10$eHozzKWgj9OA5mYXO7VZjecnwfvnQwWlT7p4DQxm8Brdycau.1Gmu'; // Hash für ""

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if ($username === $valid_user && password_verify($password, $valid_hash)) {
        $_SESSION['logged_in'] = true;
        $_SESSION['username'] = $username;
        header("Location: protected.php");
        exit;
    } else {
        $error = "Benutzername oder Passwort falsch.";
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Login fehlgeschlagen</title>
</head>
<body>
    <h2>Login fehlgeschlagen</h2>
    <p style="color:red;">
        <?php echo $error ?? ''; ?>
    </p>
    <a href="service.html">Zurück zum Login</a>
</body>
</html>
