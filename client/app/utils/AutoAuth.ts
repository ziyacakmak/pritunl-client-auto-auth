/// <reference path="../References.d.ts"/>
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

export async function load(profileId: string): Promise<AutoAuthData> {
	if (cache[profileId]) {
		return cache[profileId]
	}

	let res = await MiscUtils.exec("/usr/bin/security",
		"find-generic-password",
		"-s", serviceName,
		"-a", profileId,
		"-w")

	let data = empty()

	if (!res.error && res.stdout) {
		try {
			data = normalize(JSON.parse(res.stdout.trim()))
		} catch (err) {
			data = empty()
		}
	}

	cache[profileId] = data

	return data
}

export async function save(profileId: string,
	data: AutoAuthData): Promise<boolean> {

	data = normalize(data)

	let res = await MiscUtils.exec("/usr/bin/security",
		"add-generic-password",
		"-U",
		"-s", serviceName,
		"-a", profileId,
		"-w", JSON.stringify(data))

	if (res.error) {
		return false
	}

	cache[profileId] = data
	delete failed[profileId]

	return true
}

export async function remove(profileId: string): Promise<void> {
	delete cache[profileId]

	await MiscUtils.exec("/usr/bin/security",
		"delete-generic-password",
		"-s", serviceName,
		"-a", profileId)
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
