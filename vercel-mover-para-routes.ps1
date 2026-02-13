# Script: deixa apenas api/index.js em api/ para respeitar limite de 12 funcoes no plano Hobby.
# Rode no PowerShell na pasta do projeto: .\vercel-mover-para-routes.ps1

$root = "c:\Users\ti\Desktop\sucesso"
Set-Location $root

# 1) Criar pastas
New-Item -ItemType Directory -Path "routes" -Force | Out-Null
New-Item -ItemType Directory -Path "routes\google-calendar" -Force | Out-Null
New-Item -ItemType Directory -Path "lib" -Force | Out-Null
New-Item -ItemType Directory -Path "ai" -Force | Out-Null
New-Item -ItemType Directory -Path "ai\core" -Force | Out-Null

# 2) Mover handlers de api/ para routes/
$handlers = @(
  "copiloto", "preco", "marketing", "ocr", "estoque", "estudo-caso-pergunta",
  "estudo-caso-esclarecer", "discussao-caso", "protocolo", "pele", "skincare",
  "analise-pele", "calendario-conteudo", "webhook-transacoes", "create-portal-session"
)
foreach ($h in $handlers) {
  $src = "api\$h.js"
  if (Test-Path $src) {
    $content = Get-Content $src -Raw -Encoding UTF8
    $content = $content -replace 'from "\./ai/', 'from "../ai/'
    $content = $content -replace "from '\./ai/", "from '../ai/"
    $content = $content -replace 'from "\./lib/', 'from "../lib/'
    $content = $content -replace "from '\./lib/", "from '../lib/"
    Set-Content -Path "routes\$h.js" -Value $content -Encoding UTF8 -NoNewline:$false
    Remove-Item $src -Force
    Write-Host "OK routes/$h.js"
  }
}

# 3) Mover google-calendar
foreach ($f in @("auth", "callback", "status", "sync", "disconnect")) {
  $src = "api\google-calendar\$f.js"
  if (Test-Path $src) {
    $content = Get-Content $src -Raw -Encoding UTF8
    $content = $content -replace 'from "\.\./lib/', 'from "../../lib/'
    $content = $content -replace "from '\.\./lib/", "from '../../lib/"
    Set-Content -Path "routes\google-calendar\$f.js" -Value $content -Encoding UTF8 -NoNewline:$false
    Remove-Item $src -Force
    Write-Host "OK routes/google-calendar/$f.js"
  }
}

# 4) Mover api/lib para lib/
Get-ChildItem "api\lib\*" -File -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName -Destination "lib\$($_.Name)" -Force
  Remove-Item $_.FullName -Force
  Write-Host "OK lib/$($_.Name)"
}

# 5) Mover api/ai para ai/
Get-ChildItem "api\ai\*" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path "api\ai").Path.Length + 1)
  $dest = "ai\$rel"
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  $content = Get-Content $_.FullName -Raw -Encoding UTF8
  $content = $content -replace 'from "\.\./lib/', 'from "../../lib/'
  $content = $content -replace "from '\.\./lib/", "from '../../lib/"
  Set-Content -Path $dest -Value $content -Encoding UTF8 -NoNewline:$false
  Remove-Item $_.FullName -Force
  Write-Host "OK ai/$rel"
}

# 6) Remover pastas vazias api/lib e api/ai e api/google-calendar
Remove-Item "api\lib" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "api\ai" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "api\google-calendar" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Concluido. Em api/ deve restar apenas index.js (e talvez README)."
Write-Host "Rode: npm start  para testar localmente, depois git add . && git commit -m 'fix: uma so funcao em api/ para Vercel Hobby' && git push origin main"
