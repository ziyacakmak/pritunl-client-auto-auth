/// <reference path="../References.d.ts"/>
import path from "path"
import os from "os"
import * as MiscUtils from "./MiscUtils"
import * as Totp from "./Totp"

export interface AutoAuthData {
	enabled: boolean
	password: string
	pin: string
	secret: string
	username: string
	auto_connect: boolean
}

export interface AutoAuthCredentials {
	username: string
	password: string
}

const serviceName = "Pritunl Auto Auth"
const isWindows = process.platform === "win32"

let cache: {[key: string]: AutoAuthData} = {}
let failed: {[key: string]: boolean} = {}

export function empty(): AutoAuthData {
	return {
		enabled: false,
		password: "",
		pin: "",
		secret: "",
		username: "",
		auto_connect: false,
	}
}

function normalize(data: any): AutoAuthData {
	return {
		...empty(),
		...(data || {}),
		enabled: !!(data && data.enabled),
		auto_connect: !!(data && data.auto_connect),
		password: (data && data.password) || "",
		pin: (data && data.pin) || "",
		secret: (data && data.secret) || "",
		username: (data && data.username) || "",
	}
}

export function storageName(): string {
	return isWindows ? "Windows DPAPI" : "macOS Keychain"
}

function windowsAuthPath(profileId: string): string {
	let appData = process.env.APPDATA
	if (!appData) {
		appData = path.join(os.homedir(), "AppData", "Roaming")
	}

	return path.join(appData, "Pritunl", "auto-auth", profileId + ".bin")
}

function psQuote(value: string): string {
	return "'" + value.replace(/'/g, "''") + "'"
}

function powershell(script: string): Promise<MiscUtils.ExecOutput> {
	return MiscUtils.exec("powershell.exe",
		"-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
		"-Command", script)
}

async function loadKeychain(profileId: string): Promise<AutoAuthData> {
	let res = await MiscUtils.exec("/usr/bin/security",
		"find-generic-password",
		"-s", serviceName,
		"-a", profileId,
		"-w")

	if (res.error || !res.stdout) {
		return empty()
	}

	try {
		return normalize(JSON.parse(res.stdout.trim()))
	} catch (err) {
		return empty()
	}
}

async function saveKeychain(profileId: string,
	data: AutoAuthData): Promise<boolean> {

	let res = await MiscUtils.exec("/usr/bin/security",
		"add-generic-password",
		"-U",
		"-s", serviceName,
		"-a", profileId,
		"-w", JSON.stringify(data))

	return !res.error
}

async function removeKeychain(profileId: string): Promise<void> {
	await MiscUtils.exec("/usr/bin/security",
		"delete-generic-password",
		"-s", serviceName,
		"-a", profileId)
}

async function loadWindows(profileId: string): Promise<AutoAuthData> {
	let file = windowsAuthPath(profileId)

	let script = [
		"$ErrorActionPreference = 'Stop'",
		"Add-Type -AssemblyName System.Security",
		"$f = " + psQuote(file),
		"if (Test-Path -LiteralPath $f) {",
		"$b = [Convert]::FromBase64String((Get-Content -LiteralPath $f -Raw))",
		"$p = [System.Security.Cryptography.ProtectedData]::Unprotect($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
		"[Convert]::ToBase64String($p)",
		"}",
	].join("\n")

	let res = await powershell(script)

	if (res.error || !res.stdout || !res.stdout.trim()) {
		return empty()
	}

	try {
		let json = Buffer.from(res.stdout.trim(), "base64").toString("utf8")
		return normalize(JSON.parse(json))
	} catch (err) {
		return empty()
	}
}

async function saveWindows(profileId: string,
	data: AutoAuthData): Promise<boolean> {

	let file = windowsAuthPath(profileId)
	let encoded = Buffer.from(JSON.stringify(data), "utf8").toString("base64")

	let script = [
		"$ErrorActionPreference = 'Stop'",
		"Add-Type -AssemblyName System.Security",
		"$f = " + psQuote(file),
		"New-Item -ItemType Directory -Force -Path " +
			psQuote(path.dirname(file)) + " | Out-Null",
		"$b = [Convert]::FromBase64String(" + psQuote(encoded) + ")",
		"$p = [System.Security.Cryptography.ProtectedData]::Protect($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
		"[IO.File]::WriteAllText($f, [Convert]::ToBase64String($p), [Text.Encoding]::ASCII)",
	].join("\n")

	let res = await powershell(script)

	return !res.error
}

async function removeWindows(profileId: string): Promise<void> {
	let file = windowsAuthPath(profileId)
	let script = "Remove-Item -LiteralPath " + psQuote(file) +
		" -Force -ErrorAction SilentlyContinue"

	await powershell(script)
}

export async function load(profileId: string): Promise<AutoAuthData> {
	if (cache[profileId]) {
		return cache[profileId]
	}

	let data: AutoAuthData

	if (isWindows) {
		data = await loadWindows(profileId)
	} else {
		data = await loadKeychain(profileId)
	}

	cache[profileId] = data

	return data
}

export async function save(profileId: string,
	data: AutoAuthData): Promise<boolean> {

	data = normalize(data)

	let saved: boolean

	if (isWindows) {
		saved = await saveWindows(profileId, data)
	} else {
		saved = await saveKeychain(profileId, data)
	}

	if (!saved) {
		return false
	}

	cache[profileId] = data
	delete failed[profileId]

	return true
}

export async function remove(profileId: string): Promise<void> {
	delete cache[profileId]

	if (isWindows) {
		await removeWindows(profileId)
	} else {
		await removeKeychain(profileId)
	}
}

export function markFailed(profileId: string): void {
	failed[profileId] = true
}

export function clearFailed(profileId: string): void {
	delete failed[profileId]
}

export function isFailed(profileId: string): boolean {
	return !!failed[profileId]
}

export function buildCredentials(authTypes: string[],
	data: AutoAuthData): AutoAuthCredentials | null {

	if (!data || !data.enabled || !authTypes || !authTypes.length) {
		return null
	}

	if (authTypes.indexOf("duo") !== -1 ||
			authTypes.indexOf("onelogin") !== -1 ||
			authTypes.indexOf("okta") !== -1 ||
			authTypes.indexOf("yubikey") !== -1) {
		return null
	}

	let username = "pritunl"
	if (authTypes.indexOf("username") !== -1) {
		if (!data.username) {
			return null
		}
		username = data.username
	}

	let password = ""

	if (authTypes.indexOf("password") !== -1 && data.password) {
		password += data.password
	}

	if (authTypes.indexOf("pin") !== -1 && data.pin) {
		password += data.pin
	}

	if (authTypes.indexOf("otp") !== -1 && data.secret) {
		if (!Totp.isValidSecret(data.secret)) {
			return null
		}
		password += Totp.generateCode(data.secret)
	}

	if (!password) {
		return null
	}

	return {
		username: username,
		password: password,
	}
}
