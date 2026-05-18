<#
.SYNOPSIS
  Install CodeSee integration files into a target project.

.DESCRIPTION
  Writes to the target project root:
    - AGENTS.md                    Entry rules (skipped if exists, use -Force to overwrite)
    - .codesee/prompts/*.md        scan / scan-light / scan-heavy / sync
    - .codesee/.gitignore          Allow features.json into git, ignore caches

.EXAMPLE
  ./scripts/install.ps1 D:\path\to\project
  ./scripts/install.ps1 D:\path\to\project -Force
#>

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$TargetDir,

  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

# Locate self
$Self = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Templates = Join-Path $Self 'templates'
$Prompts   = Join-Path $Self 'prompts'

# Validate target
if (-not (Test-Path $TargetDir)) {
  Write-Error "Target directory not found: $TargetDir"
  exit 1
}
$TargetDir = (Resolve-Path $TargetDir).Path
if ($TargetDir -eq $Self) {
  Write-Error 'Cannot install CodeSee onto itself. Point to a different project.'
  exit 1
}

Write-Host "==> Installing CodeSee into: $TargetDir" -ForegroundColor Cyan

# 1. AGENTS.md
$agentsSrc     = Join-Path $Templates 'AGENTS.md'
$snippetSrc    = Join-Path $Templates 'AGENTS-snippet.md'
$agentsDst     = Join-Path $TargetDir 'AGENTS.md'
$BeginMarker   = '<!-- BEGIN: CodeSee integration -->'

if (Test-Path $agentsDst) {
  $existing = Get-Content -Raw -Encoding UTF8 -Path $agentsDst
  $snippet = Get-Content -Raw -Encoding UTF8 -Path $snippetSrc
  $EndMarker = '<!-- END: CodeSee integration -->'

  if ($existing -match [regex]::Escape($BeginMarker)) {
    if ($Force) {
      $startIdx = $existing.IndexOf($BeginMarker)
      $endIdx   = $existing.IndexOf($EndMarker)
      if ($startIdx -ge 0 -and $endIdx -gt $startIdx) {
        $before = $existing.Substring(0, $startIdx)
        $after  = $existing.Substring($endIdx + $EndMarker.Length)
        $updated = $before + $snippet.TrimEnd() + $after
        [System.IO.File]::WriteAllText($agentsDst, $updated, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  - AGENTS.md: replaced existing CodeSee section"
      } else {
        Write-Host "  - AGENTS.md: malformed CodeSee section, skipped" -ForegroundColor Yellow
      }
    } else {
      Write-Host "  - AGENTS.md: CodeSee section already present, skipped (use -Force to refresh)" -ForegroundColor Yellow
    }
  } else {
    $needsNewline = -not ($existing.EndsWith("`n"))
    $appended = $existing + ($(if ($needsNewline) { "`n" } else { '' })) + "`n" + $snippet
    [System.IO.File]::WriteAllText($agentsDst, $appended, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  - AGENTS.md: appended CodeSee section to existing file"
  }
} else {
  Copy-Item -Force $agentsSrc $agentsDst
  Write-Host "  - wrote AGENTS.md (new)"
}

# 2. .codesee/prompts/*
$dstPrompts = Join-Path $TargetDir '.codesee/prompts'
New-Item -ItemType Directory -Force -Path $dstPrompts | Out-Null
foreach ($name in @('scan.md','scan-light.md','scan-heavy.md','scan-planning.md','scan-sdd.md','sync.md','_schema.md','_rules.md')) {
  $src = Join-Path $Prompts $name
  $dst = Join-Path $dstPrompts $name
  Copy-Item -Force $src $dst
  Write-Host "  - wrote .codesee/prompts/$name"
}

# 3. .codesee/scripts/* (validator + staleness checker)
$dstScripts = Join-Path $TargetDir '.codesee/scripts'
New-Item -ItemType Directory -Force -Path $dstScripts | Out-Null
$validatorSrc = Join-Path $Self 'scripts/validate-features.mjs'
$validatorDst = Join-Path $dstScripts 'validate-features.mjs'
Copy-Item -Force $validatorSrc $validatorDst
Write-Host "  - wrote .codesee/scripts/validate-features.mjs"

$stalenessSrc = Join-Path $Self 'hooks/scripts/check-staleness.mjs'
if (Test-Path $stalenessSrc) {
  $stalenessDst = Join-Path $dstScripts 'check-staleness.mjs'
  Copy-Item -Force $stalenessSrc $stalenessDst
  Write-Host "  - wrote .codesee/scripts/check-staleness.mjs"
}

# 3a. .codesee/hooks/* (templates only; users enable manually)
$hooksSrcDir = Join-Path $Self 'hooks'
if (Test-Path $hooksSrcDir) {
  $dstHooks = Join-Path $TargetDir '.codesee/hooks'
  New-Item -ItemType Directory -Force -Path $dstHooks | Out-Null
  foreach ($subdir in @('claude-code','kiro')) {
    $src = Join-Path $hooksSrcDir $subdir
    $dst = Join-Path $dstHooks $subdir
    if (Test-Path $src) {
      New-Item -ItemType Directory -Force -Path $dst | Out-Null
      Copy-Item -Force -Recurse "$src/*" $dst
      Write-Host "  - wrote .codesee/hooks/$subdir/*"
    }
  }
  $hookReadmeSrc = Join-Path $hooksSrcDir 'README.md'
  if (Test-Path $hookReadmeSrc) {
    Copy-Item -Force $hookReadmeSrc (Join-Path $dstHooks 'README.md')
    Write-Host "  - wrote .codesee/hooks/README.md"
  }
}

# 3b. SDD framework detection
$sddDetected = @()
foreach ($probe in @(
    @{ Path = '.specify';        Name = 'spec-kit (GitHub)' },
    @{ Path = '.trellis';        Name = 'Trellis (Mindfold)' },
    @{ Path = '.bmad-core';      Name = 'BMAD-METHOD' },
    @{ Path = 'bmad';            Name = 'BMAD-METHOD' },
    @{ Path = '.agents/skills';  Name = 'Agent Skills (agentskills.io)' },
    @{ Path = '.agent-os';       Name = 'Agent OS (Builder Methods)' }
)) {
  if (Test-Path (Join-Path $TargetDir $probe.Path)) {
    $sddDetected += $probe.Name
  }
}

# 3c. Install SKILL.md if Agent Skills standard is in use, or alongside AGENTS.md as compatible entry
$skillSrc = Join-Path $Templates 'SKILL.md'
if (Test-Path $skillSrc) {
  $skillDir = Join-Path $TargetDir '.agents/skills/codesee'
  $skillDst = Join-Path $skillDir 'SKILL.md'
  if (-not (Test-Path $skillDst) -or $Force) {
    New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
    Copy-Item -Force $skillSrc $skillDst
    Write-Host "  - wrote .agents/skills/codesee/SKILL.md (cross-platform skill entry)"
  } else {
    Write-Host "  - .agents/skills/codesee/SKILL.md already present, skipped (use -Force to refresh)" -ForegroundColor Yellow
  }
}

# 4. .codesee/.gitignore
$gitignore = Join-Path $TargetDir '.codesee/.gitignore'
if (-not (Test-Path $gitignore)) {
  $gi = @(
    '# CodeSee keeps features.json under version control (it is the core data).',
    '# Only transient caches are ignored here.',
    'cache/',
    '*.tmp'
  ) -join "`n"
  # Write as UTF-8 without BOM
  [System.IO.File]::WriteAllText($gitignore, $gi + "`n", [System.Text.UTF8Encoding]::new($false))
  Write-Host "  - wrote .codesee/.gitignore"
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
if ($sddDetected.Count -gt 0) {
  Write-Host ''
  Write-Host ("SDD frameworks detected: " + ($sddDetected -join ', ')) -ForegroundColor Cyan
  Write-Host '  AI will use SDD mode (consume spec/PRD docs, no source code) for higher accuracy.' -ForegroundColor Cyan
}
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '  1. Open the target project in your AI IDE; ask it to read AGENTS.md.'
Write-Host '  2. Let the AI run the scan (first time) or sync (after each change).'
Write-Host '  3. (Optional) Enable hooks: see .codesee/hooks/README.md to wire'
Write-Host '     check-staleness into Claude Code / Kiro for auto reminders.'
Write-Host '  4. View the graph in your browser: https://Kaka-cheaper.github.io/codeSee/'
Write-Host '     -> click "+ Add project" and select this directory.'
Write-Host ''
Write-Host "Run viewer locally (contributors):  cd `"$Self/viewer`"; npm run dev" -ForegroundColor DarkGray
