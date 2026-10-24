<?php
// MedSchoolProffs file bridge (cPanel).  Stores big book PDFs on the cPanel disk.
// Only the API server talks to this script (it sends the shared secret); students never get a link to the files.
// Install: see README.md in this folder.

declare(strict_types=1);
@set_time_limit(0);
@ini_set('display_errors', '0');
header('Cache-Control: no-store');

$cfgFile = __DIR__ . '/config.php';
$cfg = is_file($cfgFile) ? (require $cfgFile) : [];
$secret = (string)($cfg['secret'] ?? getenv('FILE_BRIDGE_SECRET') ?: '');
$dir = rtrim((string)($cfg['dir'] ?? (dirname(__DIR__, 2) . '/msp-files')), '/');   // default: above public_html
$maxBytes = (int)($cfg['max_bytes'] ?? 2 * 1024 * 1024 * 1024);

function out(int $code, array $body): void { http_response_code($code); header('Content-Type: application/json'); echo json_encode($body); exit; }

$sent = $_SERVER['HTTP_X_BRIDGE_SECRET'] ?? '';
if ($secret === '' ) out(500, ['ok' => false, 'error' => 'Bridge secret is not configured (config.php).']);
if (!hash_equals($secret, (string)$sent)) out(401, ['ok' => false, 'error' => 'Unauthorized']);

$a = (string)($_GET['a'] ?? '');
$name = (string)($_GET['name'] ?? '');
// books/<id>.pdf  (id = letters/digits/_/-). Nothing else is accepted, so paths can't escape the folder.
if ($a !== 'ping' && !preg_match('#^books/[A-Za-z0-9_-]{8,64}\.pdf$#', $name)) out(400, ['ok' => false, 'error' => 'Bad file name']);
if (!is_dir($dir . '/books') && !@mkdir($dir . '/books', 0750, true) && !is_dir($dir . '/books')) out(500, ['ok' => false, 'error' => 'Cannot create the storage folder: ' . $dir]);
@file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
$final = $dir . '/' . $name;
$part = $final . '.part';

switch ($a) {
  case 'ping':
    out(200, ['ok' => true, 'dir' => $dir, 'freeBytes' => (int)@disk_free_space($dir)]);

  case 'append': {   // POST raw chunk;  ?offset=N   (safe to repeat: a chunk that was already applied is accepted)
    $offset = (int)($_GET['offset'] ?? -1);
    if ($offset < 0) out(400, ['ok' => false, 'error' => 'Bad offset']);
    $have = is_file($part) ? (int)filesize($part) : 0;
    if ($offset === 0 && $have > 0) { @unlink($part); $have = 0; }
    $in = fopen('php://input', 'rb');
    // read the body first so a retry of an already-applied chunk can be recognised by its length
    $tmp = fopen('php://temp/maxmemory:' . (16 * 1024 * 1024), 'w+b');
    $len = (int)stream_copy_to_stream($in, $tmp); fclose($in);
    if ($len <= 0) out(400, ['ok' => false, 'error' => 'Empty chunk']);
    if ($have === $offset + $len) out(200, ['ok' => true, 'size' => $have, 'repeat' => true]);
    if ($have !== $offset) out(409, ['ok' => false, 'error' => 'Offset mismatch', 'size' => $have]);
    if ($have + $len > $maxBytes) out(413, ['ok' => false, 'error' => 'File is larger than the bridge limit']);
    if (@disk_free_space($dir) !== false && disk_free_space($dir) < $len + 50 * 1024 * 1024) out(507, ['ok' => false, 'error' => 'The cPanel account is out of disk space']);
    rewind($tmp);
    $fh = fopen($part, 'ab');
    if (!$fh) out(500, ['ok' => false, 'error' => 'Cannot write the file']);
    flock($fh, LOCK_EX);
    stream_copy_to_stream($tmp, $fh); fflush($fh); flock($fh, LOCK_UN); fclose($fh); fclose($tmp);
    clearstatcache(true, $part);
    out(200, ['ok' => true, 'size' => (int)filesize($part)]);
  }

  case 'finish': {
    if (!is_file($part)) out(404, ['ok' => false, 'error' => 'Nothing was uploaded']);
    $fh = fopen($part, 'rb'); $head = (string)fread($fh, 1024); fclose($fh);
    if (strpos($head, '%PDF-') === false) { @unlink($part); out(422, ['ok' => false, 'error' => 'That file is not a PDF']); }
    if (!@rename($part, $final)) out(500, ['ok' => false, 'error' => 'Could not finish the file']);
    out(200, ['ok' => true, 'size' => (int)filesize($final)]);
  }

  case 'stat':
    if (!is_file($final)) out(404, ['ok' => false, 'error' => 'Not found']);
    out(200, ['ok' => true, 'size' => (int)filesize($final)]);

  case 'delete':
    @unlink($final); @unlink($part);
    out(200, ['ok' => true]);

  case 'get': {      // streams the file, with Range support (the API server caches it on its own disk)
    if (!is_file($final)) out(404, ['ok' => false, 'error' => 'Not found']);
    $size = (int)filesize($final); $start = 0; $end = $size - 1;
    if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', $_SERVER['HTTP_RANGE'], $m)) {
      if ($m[1] !== '') { $start = (int)$m[1]; if ($m[2] !== '') $end = min((int)$m[2], $end); }
      elseif ($m[2] !== '') { $start = max(0, $size - (int)$m[2]); }
      if ($start > $end || $start >= $size) { header("Content-Range: bytes */$size"); http_response_code(416); exit; }
      http_response_code(206); header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Type: application/pdf'); header('Accept-Ranges: bytes'); header('Content-Length: ' . ($end - $start + 1));
    while (ob_get_level()) @ob_end_clean();
    $fh = fopen($final, 'rb'); fseek($fh, $start); $left = $end - $start + 1;
    while ($left > 0 && !feof($fh)) { $d = fread($fh, min(1024 * 1024, $left)); if ($d === false) break; echo $d; $left -= strlen($d); flush(); }
    fclose($fh); exit;
  }

  default:
    out(400, ['ok' => false, 'error' => 'Unknown action']);
}
