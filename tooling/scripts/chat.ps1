$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$workspace = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile = Join-Path $workspace '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing $envFile"
}

$tokenLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -like 'ASSISTANT_API_TOKEN=*' } | Select-Object -First 1
$token = ($tokenLine -split '=', 2)[1]

if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'ASSISTANT_API_TOKEN is missing in .env'
}

$headers = @{Authorization = "Bearer $token"}
$responseId = $null

Clear-Host
Write-Host 'Autocubes Codex Chat' -ForegroundColor Cyan
Write-Host 'Type a message and press Enter. Use /new for a new conversation or /exit to close.' -ForegroundColor DarkGray
Write-Host ''

while ($true) {
  $prompt = Read-Host 'You'
  if ($prompt -eq '/exit') { break }
  if ($prompt -eq '/new') {
    $responseId = $null
    Write-Host 'Started a new conversation.' -ForegroundColor DarkGray
    continue
  }
  if ([string]::IsNullOrWhiteSpace($prompt)) { continue }

  $payload = @{prompt = $prompt}
  if ($responseId) { $payload.previousResponseId = $responseId }

  try {
    Write-Host 'Thinking...' -ForegroundColor DarkGray
    $response = Invoke-RestMethod `
      -Uri 'http://127.0.0.1:4178/api/assistant' `
      -Method Post `
      -Headers $headers `
      -ContentType 'application/json; charset=utf-8' `
      -Body ($payload | ConvertTo-Json -Compress) `
      -TimeoutSec 150

    $responseId = $response.responseId
    Write-Host ''
    Write-Host 'Assistant:' -ForegroundColor Cyan
    Write-Host $response.answer
    Write-Host ''
  } catch {
    Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
  }
}
