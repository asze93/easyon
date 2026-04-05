$httpListener = New-Object System.Net.HttpListener
$httpListener.Prefixes.Add("http://127.0.0.1:8080/")
$httpListener.Start()
Write-Output "PowerShell Server started on http://127.0.0.1:8080/"
try {
    while ($httpListener.IsListening) {
        $context = $httpListener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
        $filePath = Join-Path (Get-Location) $localPath
        
        if (Test-Path $filePath) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $httpListener.Stop()
}
