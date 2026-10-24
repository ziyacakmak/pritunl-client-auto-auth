# Build the Windows client and an unsigned Inno Setup installer.
# Run from a Windows machine or a windows-latest GitHub Actions runner.

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Build = Join-Path $Root "build"
$Client = Join-Path $Root "client"
$Service = Join-Path $Root "service"
$Cli = Join-Path $Root "cli"

function Invoke-Checked {
	param(
		[string]$File,
		[string[]]$Arguments
	)

	& $File @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "Command failed ($LASTEXITCODE): $File $($Arguments -join ' ')"
	}
}

if (Test-Path $Build) {
	Remove-Item $Build -Recurse -Force
}

Write-Host "==> Building Windows service"
Push-Location $Service
try {
	$env:CGO_ENABLED = "0"
	$env:GOOS = "windows"
	$env:GOARCH = "amd64"
	Invoke-Checked "go" @("build", "-v", "-ldflags", "-H windowsgui",
		"-o", "service_amd64.exe", ".")

	$env:GOARCH = "arm64"
	Invoke-Checked "go" @("build", "-v", "-ldflags", "-H windowsgui",
		"-o", "service_arm64.exe", ".")
} finally {
	Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
	Remove-Item Env:GOOS -ErrorAction SilentlyContinue
	Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
	Pop-Location
}

Write-Host "==> Building Windows CLI"
Push-Location $Cli
try {
	$env:CGO_ENABLED = "0"
	$env:GOOS = "windows"
	$env:GOARCH = "amd64"
	Invoke-Checked "go" @("build", "-v", "-o", "cli_amd64.exe", ".")

	$env:GOARCH = "arm64"
	Invoke-Checked "go" @("build", "-v", "-o", "cli_arm64.exe", ".")
} finally {
	Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
	Remove-Item Env:GOOS -ErrorAction SilentlyContinue
	Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
	Pop-Location
}

Write-Host "==> Building Electron client"
Push-Location $Client
try {
	Invoke-Checked "npm" @("ci")
	Invoke-Checked "bash" @("build.sh")

	$packager = Join-Path $Client "node_modules\@electron\packager\bin\electron-packager.js"
	if (-not (Test-Path $packager)) {
		throw "electron-packager not found at $packager"
	}

	Invoke-Checked "node" @($packager, ".", "pritunl",
		"--platform=win32", "--arch=x64",
		"--icon=www/img/logo.ico",
		"--out=../build/win", "--prune", "--asar", "--overwrite",
		'--ignore=^/dist-dev($|/)', '--ignore=^/build-local($|/)')

	Invoke-Checked "node" @($packager, ".", "pritunl",
		"--platform=win32", "--arch=arm64",
		"--icon=www/img/logo.ico",
		"--out=../build/win", "--prune", "--asar", "--overwrite",
		'--ignore=^/dist-dev($|/)', '--ignore=^/build-local($|/)')
} finally {
	Pop-Location
}

Write-Host "==> Building installer"
$iscc = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
if ($iscc) {
	$isccPath = $iscc.Source
} else {
	$candidates = @(
		"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
		"C:\Program Files\Inno Setup 6\ISCC.exe"
	)
	$isccPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $isccPath) {
	throw "Inno Setup 6 (ISCC.exe) was not found"
}

Invoke-Checked $isccPath @((Join-Path $Root "resources_win\setup-auto-auth.iss"))

$installer = Join-Path $Build "Pritunl-AutoAuth-1.4.4777.90-setup.exe"
if (-not (Test-Path $installer)) {
	throw "Installer was not created at $installer"
}

Write-Host "==> Done: $installer"
