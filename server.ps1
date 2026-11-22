# Windows built-in fallback when Python is not installed. Loopback only, no admin required.
$ErrorActionPreference = 'Stop'
$gameRoot = $PSScriptRoot
$port = 8710
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "COIN 10S running at http://127.0.0.1:$port/ - close this window to stop"
Start-Process "http://127.0.0.1:$port/"
$mime = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css';'.json'='application/json';'.png'='image/png';'.mp4'='video/mp4';'.woff2'='font/woff2';'.otf'='font/otf';'.ttf'='font/ttf';'.jpg'='image/jpeg';'.mp3'='audio/mpeg'}
try {
 while ($true) {
  $client = $listener.AcceptTcpClient()
  $stream = $client.GetStream()
  $stream.ReadTimeout = 3000
  try {
   $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
   $request = $reader.ReadLine()
   if (-not $request) { continue }
   while (($line = $reader.ReadLine()) -and $line.Length -gt 0) {}
   $parts = $request.Split(' ')
   $path = [System.Uri]::UnescapeDataString(($parts[1].Split('?')[0])).Replace('/', [System.IO.Path]::DirectorySeparatorChar).TrimStart([System.IO.Path]::DirectorySeparatorChar)
   if (-not $path) { $path = 'index.html' }
   $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($gameRoot, $path))
   if (-not $file.StartsWith($gameRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($file)) {
    $data = [System.Text.Encoding]::UTF8.GetBytes('Not found');$status='404 Not Found';$type='text/plain'
   } else {
    $data=[System.IO.File]::ReadAllBytes($file);$status='200 OK';$type=$mime[[System.IO.Path]::GetExtension($file).ToLower()];if(-not $type){$type='application/octet-stream'}
   }
   $head="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($data.Length)`r`nCache-Control: no-store, no-cache, must-revalidate`r`nPragma: no-cache`r`nConnection: close`r`n`r`n"
   $bytes=[System.Text.Encoding]::ASCII.GetBytes($head);$stream.Write($bytes,0,$bytes.Length)
   if ($parts[0] -ne 'HEAD') { $stream.Write($data,0,$data.Length) }
   $stream.Flush()
  } catch { Write-Verbose $_.Exception.Message } finally { $client.Close() }
 }
} finally { $listener.Stop() }
