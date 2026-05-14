<#
.SYNOPSIS
  把 CodeSee 集成文件安装到目标项目。

.DESCRIPTION
  目标项目根目录会被注入：
    - AGENTS.md                    入口规则（若已存在则提示是否覆盖）
    - .codesee/prompts/*.md        scan / scan-light / scan-heavy / sync
    - .codesee/.gitignore          忽略 features.json 之外的临时产物（默认入库 features.json）

.EXAMPLE
  ./scripts/install.ps1 D:\桌面\github_project\Polisim
#>

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$TargetDir,

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

# 自身定位
$Self = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Templates = Join-Path $Self 'templates'
$Prompts   = Join-Path $Self 'prompts'

# 校验目标目录
if (-not (Test-Path $TargetDir)) {
  Write-Error "目标目录不存在: $TargetDir"
  exit 1
}
$TargetDir = (Resolve-Path $TargetDir).Path
if ($TargetDir -eq $Self) {
  Write-Error '不能把 CodeSee 安装到自己。请指向另一个项目。'
  exit 1
}

Write-Host "→ 安装 CodeSee 到: $TargetDir" -ForegroundColor Cyan

# 1. AGENTS.md
$agentsSrc = Join-Path $Templates 'AGENTS.md'
$agentsDst = Join-Path $TargetDir 'AGENTS.md'
if ((Test-Path $agentsDst) -and -not $Force) {
  Write-Host "  · AGENTS.md 已存在，跳过（用 -Force 覆盖）" -ForegroundColor Yellow
} else {
  Copy-Item -Force $agentsSrc $agentsDst
  Write-Host "  · 写入 AGENTS.md"
}

# 2. .codesee/prompts/*
$dstPrompts = Join-Path $TargetDir '.codesee/prompts'
New-Item -ItemType Directory -Force -Path $dstPrompts | Out-Null
foreach ($name in @('scan.md','scan-light.md','scan-heavy.md','sync.md')) {
  $src = Join-Path $Prompts $name
  $dst = Join-Path $dstPrompts $name
  Copy-Item -Force $src $dst
  Write-Host "  · 写入 .codesee/prompts/$name"
}

# 3. .codesee/.gitignore（默认让 features.json 入库，忽略其余 .codesee 临时产物）
$gitignore = Join-Path $TargetDir '.codesee/.gitignore'
if (-not (Test-Path $gitignore)) {
  @(
    '# CodeSee 默认让 features.json 入库（核心数据，需要 review）',
    '# 这里只忽略后续可能产生的临时/缓存文件。',
    'cache/',
    '*.tmp',
    ''
  ) | Out-File -FilePath $gitignore -Encoding utf8
  Write-Host "  · 写入 .codesee/.gitignore"
}

Write-Host ''
Write-Host '✓ 安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '下一步：' -ForegroundColor Cyan
Write-Host '  1. 在目标项目里打开 AI IDE，提示 AI 读 AGENTS.md'
Write-Host '  2. 让它执行扫描（首次 → scan，之后每轮改动 → sync）'
Write-Host '  3. 在 CodeSee viewer 里打开 .codesee/features.json 即可看到画布'
Write-Host ''
Write-Host "viewer 启动: cd $Self/mvp-web; npm run dev" -ForegroundColor DarkGray
