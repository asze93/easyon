# EASYON STABLE LOCAL SERVER 💎🚀
# Port: 8080
$port = 8080
$prefix = "http://127.0.0.1:$port/"
$httpListener = New-Object System.Net.HttpListener
$httpListener.Prefixes.Add($prefix)

Write-Output "💎 EasyON Diamond Server starting on $prefix"
Write-Output "👉 Open your browser at: http://127.0.0.1:$port/"

try {
    $httpListener.Start()
    while ($httpListener.IsListening) {
        $context = $httpListener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
        $filePath = [IO.Path]::GetFullPath((Join-Path (Get-Location) $localPath))
        
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                ".webp" { $response.ContentType = "image/webp" }
                default { $response.ContentType = "application/octet-stream" }
            }
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            Write-Output "⚠️ 404: $localPath"
        }
        $response.Close()
    }
} catch {
    Write-Output "❌ Error: $($_.Exception.Message)"
} finally {
    $httpListener.Stop()
}
