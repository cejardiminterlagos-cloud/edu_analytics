$ErrorActionPreference = 'Stop'
$serviceRoot = $PSScriptRoot
$healthURL = 'http://127.0.0.1:8766/health'
function Test-RapidReady {
    try {
        $response = Invoke-RestMethod -Uri $healthURL -TimeoutSec 2
        return $response.engine -eq 'RapidOCR' -and $response.version -eq 1
    } catch { return $false }
}
if (Test-RapidReady) { Write-Host 'RapidOCR ja esta pronto. Volte ao Se Liga!'; exit 0 }
$rapidPython = Join-Path $serviceRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $rapidPython)) {
    throw 'Python do RapidOCR nao encontrado. Consulte rapidocr-local/README.md para instalar as dependencias.'
}
$logRoot = Join-Path $serviceRoot '.runtime'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$serverPath = Join-Path $serviceRoot 'server.py'
$process = Start-Process -FilePath $rapidPython -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $serviceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'service.log') -RedirectStandardError (Join-Path $logRoot 'errors.log')
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-RapidReady) { Write-Host 'RapidOCR pronto. Volte ao Se Liga! e selecione as imagens.'; exit 0 }
    if ($process.HasExited) { throw 'RapidOCR encerrou durante a inicializacao. Consulte .runtime/errors.log.' }
    Start-Sleep -Milliseconds 1000
}
throw 'RapidOCR ainda nao respondeu. Consulte .runtime/errors.log e tente novamente.'
