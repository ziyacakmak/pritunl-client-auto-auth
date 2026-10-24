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
		buttons: ["Open Login Items Settings"],
		title: "Pritunl Client - Service Approval Required",
		message: "The Pritunl background service must be enabled " +
			"to use Pritunl Client. Approve the Background Items " +
			"notification or open System Settings > " +
			"General > Login Items & Extensions and enable Pritunl " +
			"under Allow in the Background.",
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
		Logger.error("Daemon: Skipping service restart, " +
			"service not running")
		return
	}

	await unregister()
	await sleep(1000)
	await register()

	let state = await status()
	Logger.info("Daemon: Service state after restart '" + state + "'")

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
	Logger.info("Daemon: Service state '" + state + "'")
	if (state === "") {
		return
	}

	if (state === "notRegistered" || state === "notFound") {
		await register()
		state = await status()
		Logger.info("Daemon: Service register state '" + state + "'")
	}

	if (state === "requiresApproval") {
		state = await approve()
		Logger.info("Daemon: Service approval state '" + state + "'")
	}

	if (state !== "enabled") {
		Logger.error("Daemon: Failed to register service " +
			"(state: " + state + ")")
		return
	}

	if (await waitService(6000)) {
		return
	}

	Logger.warning("Daemon: Service enabled but not running, " +
		"re-registering service")
	await register()
	state = await status()
	Logger.info("Daemon: Service run state '" + state + "'")

	if (state === "requiresApproval") {
		state = await approve()
	}

	if (await waitService(6000)) {
		return
	}

	Logger.warning("Daemon: Service enabled but not running, " +
		"waiting for user approval")
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

	Logger.error("Daemon: Timed out waiting for service to start")
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

	Logger.info("Daemon: Service version mismatch, restarting service " +
		"(app: " + appVer + " service: " + serviceVer + ")")

	await restart()
}
