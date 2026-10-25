import path from "path"
import process from "process"
import electron from "electron"
import * as Utils from "./Utils"
import * as Auth from "./Auth"
import * as Logger from "./Logger"
import * as Request from "./Request"
import * as RequestUtils from "./RequestUtils"
import * as Service from "./Service"
import * as Constants from "./Constants"

let helperPath = path.join(path.dirname(process.execPath),
	"pritunl-service-helper")
let approvalShown = false
let restarted = false

function sleep(ms: number): Promise<void> {
	return new Promise<void>((resolve): void => {
		setTimeout(resolve, ms)
	})
}

export async function status(): Promise<string> {
	let output = await Utils.exec(helperPath, "status")
	if (output.error) {
		Logger.error(output.error)
		return ""
	}
	return output.stdout.trim()
}

export async function register(): Promise<void> {
	let output = await Utils.exec(helperPath, "register")
	if (output.error) {
		Logger.error(output.error)
	}
}

export async function unregister(): Promise<void> {
	let output = await Utils.exec(helperPath, "unregister")
	if (output.error) {
		Logger.error(output.error)
	}
}

export async function openSettings(): Promise<void> {
	let output = await Utils.exec(helperPath, "open-settings")
	if (output.error) {
		Logger.error(output.error)
	}
}

function ping(): Promise<boolean> {
	return new Promise<boolean>((resolve): void => {
		RequestUtils
			.get("/ping")
			.set("Auth-Token", Auth.token)
			.set("User-Agent", "pritunl")
			.end()
			.then((resp: Request.Response) => {
				resolve(resp.status === 200)
			}, () => {
				resolve(false)
			})
	})
}

async function waitService(timeout: number): Promise<boolean> {
	let delay = 500
	let elapsed = 0

	while (elapsed < timeout) {
		if (!Auth.token) {
			try {
				await Auth.load()
			} catch (err) {
			}
		}

		if (Auth.token && await ping()) {
			return true
		}

		await sleep(delay)
		elapsed += delay
		delay = Math.min(Math.floor(delay * 1.5), 3000)
	}

	return false
}

function showApproval(): void {
	if (approvalShown) {
		return
	}
	approvalShown = true

	electron.dialog.showMessageBox(null, {
		type: "info",
		buttons: ["Oturum Açma Öğeleri Ayarlarını Aç"],
		title: "pritunl++ - Hizmet Onayı Gerekli",
		message: "pritunl++ kullanmak için Pritunl arka plan hizmeti " +
			"etkinleştirilmelidir. Arka Plan Öğeleri bildirimini onaylayın " +
			"veya Sistem Ayarları > Genel > Oturum Açma Öğeleri ve " +
			"Uzantılar bölümünü açıp Arka Planda İzin Ver altında " +
			"Pritunl'u etkinleştirin.",
	}).then((evt) => {
		approvalShown = false
		if (evt.response === 0) {
			openSettings()
		}
	})
}

async function approve(): Promise<string> {
	showApproval()

	let state = await status()
	while (state === "requiresApproval") {
		await sleep(1000)
		state = await status()
	}

	return state
}

export async function restart(): Promise<void> {
	if (!Auth.token || !await ping()) {
		Logger.error("Daemon: Hizmet yeniden başlatılıyor, " +
			"hizmet çalışmıyor")
		return
	}

	await unregister()
	await sleep(1000)
	await register()

	let state = await status()
	Logger.info("Daemon: Yeniden başlatma sonrası hizmet durumu '" + state + "'")

	if (state === "requiresApproval") {
		state = await approve()
	}

	if (state === "enabled") {
		await waitService(6000)
	}
}

export async function ensure(): Promise<void> {
	if (process.platform !== "darwin" || !Constants.production ||
		!Constants.smAppService) {

		return
	}

	let state = await status()
	Logger.info("Daemon: Hizmet durumu '" + state + "'")
	if (state === "") {
		return
	}

	if (state === "notRegistered" || state === "notFound") {
		await register()
		state = await status()
		Logger.info("Daemon: Hizmet kayıt durumu '" + state + "'")
	}

	if (state === "requiresApproval") {
		state = await approve()
		Logger.info("Daemon: Hizmet onay durumu '" + state + "'")
	}

	if (state !== "enabled") {
		Logger.error("Daemon: Hizmet kaydedilemedi " +
			"(durum: " + state + ")")
		return
	}

	if (await waitService(6000)) {
		return
	}

	Logger.warning("Daemon: Hizmet etkin ancak çalışmıyor, " +
		"hizmet yeniden kaydediliyor")
	await register()
	state = await status()
	Logger.info("Daemon: Hizmet çalışma durumu '" + state + "'")

	if (state === "requiresApproval") {
		state = await approve()
	}

	if (await waitService(6000)) {
		return
	}

	Logger.warning("Daemon: Hizmet etkin ancak çalışmıyor, " +
		"kullanıcı onayı bekleniyor")
	showApproval()

	for (let i = 0; i < 10; i++) {
		state = await status()
		if (state === "requiresApproval") {
			showApproval()
		}

		if (await waitService(6000)) {
			return
		}
	}

	Logger.error("Daemon: Hizmetin başlaması beklenirken zaman aşımı")
}

export async function checkUpgrade(): Promise<void> {
	if (process.platform !== "darwin" || !Constants.production ||
		!Constants.smAppService) {

		return
	}

	let serviceVer = await Service.version()
	let appVer = electron.app.getVersion()

	if (!serviceVer || serviceVer === appVer || restarted) {
		return
	}
	restarted = true

	Logger.info("Daemon: Hizmet sürümü uyuşmuyor, hizmet yeniden başlatılıyor " +
		"(uygulama: " + appVer + " hizmet: " + serviceVer + ")")

	await restart()
}
