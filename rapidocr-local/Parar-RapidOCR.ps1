$ErrorActionPreference = 'Stop'
$pidPath = Join-Path $PSScriptRoot '.runtime/service.json'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Host 'Nenhum servico iniciado por este atalho.'; exit 0 }
$state = Get-Content -LiteralPath $pidPath -Raw -Encoding UTF8 | ConvertFrom-Json
$rapidProcess = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
if ($rapidProcess) {
    $recordedAt = [DateTimeOffset]::Parse($state.startedAt).UtcDateTime
    $processStart = $rapidProcess.StartTime.ToUniversalTime()
    if ($rapidProcess.Path -ne $state.executable -or $processStart -gt $recordedAt -or $processStart -lt $recordedAt.AddMinutes(-5)) {
        throw 'Nao foi possivel confirmar o processo do RapidOCR. Nenhum processo foi encerrado.'
    }
    Stop-Process -Id $rapidProcess.Id -ErrorAction Stop
}
Remove-Item -LiteralPath $pidPath
Write-Host 'RapidOCR encerrado. Nenhuma nota ou imagem foi alterada.'
