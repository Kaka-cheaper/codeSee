<#
.SYNOPSIS
  Install CodeSee integration files into a target project.

.DESCRIPTION
  Writes to the target project root:
    - AGENTS.md                    Entry rules (skipped if exists, use -Force to overwrite)
    - .codesee/prompts/*.md        scan / scan-light / scan-heavy / sync
    - .codesee/.gitignore          Allow features.json into git, ignore caches
    - .codesee/hooks/*             Hook templates (do not auto-enable unless asked)
    - .codesee/scripts/*           validator + check-staleness

  Hook auto-wiring (Phase 2, opt-in):
    -EnableClaudeCode    Merge a Stop hook into <target>/.claude/settings.json.
                         Existing user entries are preserved; our entry is tagged
                         with "_codesee" so reruns stay idempotent.
    -EnableKiro          Drop a hook file into <target>/.kiro/hooks/codesee-sync-on-stop.kiro.hook.
    -AutoDetect          Equivalent to -EnableClaudeCode / -EnableKiro driven by
                         which directories exist in the target.
    -ForceHooks          Replace our existing hook entry even if the user changed it.
    -UninstallHooks      Remove every entry tagged with _codesee and any
                         .kiro/hooks/codesee-*.kiro.hook. Templates stay.

.EXAMPLE
  ./scripts/install.ps1 D:\path\to\project
  ./scripts/install.ps1 D:\path\to\project -Force
  ./scripts/install.ps1 D:\path\to\project -AutoDetect
  ./scripts/install.ps1 D:\path\to\project -EnableClaudeCode -ForceHooks
  ./scripts/install.ps1 D:\path\to\project -UninstallHooks
#>

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$TargetDir,

  [switch]$Force,
  [switch]$EnableClaudeCode,
  [switch]$EnableKiro,
  [switch]$AutoDetect,
  [switch]$UninstallHooks,
  [switch]$ForceHooks
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

$applyPatchSrc = Join-Path $Self 'scripts/apply-patch.mjs'
if (Test-Path $applyPatchSrc) {
  $applyPatchDst = Join-Path $dstScripts 'apply-patch.mjs'
  Copy-Item -Force $applyPatchSrc $applyPatchDst
  Write-Host "  - wrote .codesee/scripts/apply-patch.mjs"
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

# 5. Phase 2 - optional auto-wiring of platform hooks
$wantClaudeCode = $false
$wantKiro = $false
if ($AutoDetect) {
  if (Test-Path (Join-Path $TargetDir '.claude')) { $wantClaudeCode = $true }
  if (Test-Path (Join-Path $TargetDir '.kiro'))   { $wantKiro = $true }
}
if ($EnableClaudeCode) { $wantClaudeCode = $true }
if ($EnableKiro)       { $wantKiro = $true }

$mergeScript = Join-Path $Self 'scripts/merge-claude-settings.mjs'
$ccTemplate  = Join-Path $Self 'hooks/claude-code/settings.json'

if ($UninstallHooks) {
  Write-Host ''
  Write-Host '==> Uninstalling CodeSee hooks (templates and validator stay).' -ForegroundColor Cyan
  if (Test-Path $mergeScript) {
    & node $mergeScript --target $TargetDir --template $ccTemplate --remove
  }
  $kiroDir = Join-Path $TargetDir '.kiro/hooks'
  if (Test-Path $kiroDir) {
    Get-ChildItem $kiroDir -Filter 'codesee-*.kiro.hook' -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item $_.FullName -Force
      Write-Host ("  - removed " + $_.FullName)
    }
    # Also clean up legacy .json named hooks from earlier install versions
    Get-ChildItem $kiroDir -Filter 'codesee-*.json' -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item $_.FullName -Force
      Write-Host ("  - removed " + $_.FullName + " (legacy)")
    }
  }
} elseif ($wantClaudeCode -or $wantKiro) {
  Write-Host ''
  Write-Host '==> Wiring platform hooks.' -ForegroundColor Cyan

  if ($wantClaudeCode) {
    if (-not (Test-Path $mergeScript)) {
      Write-Host '  - merge-claude-settings.mjs not found, skipping Claude Code wiring' -ForegroundColor Yellow
    } else {
      $nodeArgs = @('--target', $TargetDir, '--template', $ccTemplate)
      if ($ForceHooks) { $nodeArgs += '--force' }
      & node $mergeScript @nodeArgs
    }
  }

  if ($wantKiro) {
    $kiroDst = Join-Path $TargetDir '.kiro/hooks'
    New-Item -ItemType Directory -Force -Path $kiroDst | Out-Null
    $kiroSrc = Join-Path $Self 'hooks/kiro/sync-on-stop.kiro.hook'
    if (Test-Path $kiroSrc) {
      $kiroOut = Join-Path $kiroDst 'codesee-sync-on-stop.kiro.hook'
      Copy-Item -Force $kiroSrc $kiroOut
      Write-Host "  - wrote $kiroOut"
    }
  }
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
if ($wantClaudeCode -or $wantKiro -or $UninstallHooks) {
  Write-Host '  3. Hooks are now auto-wired. Restart the IDE if it had settings open.'
} else {
  Write-Host '  3. (Optional) Auto-wire hooks: rerun with -AutoDetect (or'
  Write-Host '     -EnableClaudeCode / -EnableKiro). Manual setup: .codesee/hooks/README.md.'
}
Write-Host '  4. View the graph in your browser: https://Kaka-cheaper.github.io/codeSee/'
Write-Host '     -> click "+ Add project" and select this directory.'
Write-Host ''
Write-Host "Run viewer locally (contributors):  cd `"$Self/viewer`"; npm run dev" -ForegroundColor DarkGray
