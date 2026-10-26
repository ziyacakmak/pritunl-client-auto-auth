import fs from "fs"
import path from "path"
import electron from "electron"
import * as Errors from "./Errors"
import * as Constants from "./Constants";

function push(level: string, err: any): void {
	if (!err) {
		err = "Tanımsız hata"
	}

	let time = new Date()
	let msg = err.message || err

	msg = "[" + time.getFullYear() + "-" +
		String(time.getMonth() + 1).padStart(2, "0") + "-" +
		String(time.getDate()).padStart(2, "0") + " " +
		String(time.getHours()).padStart(2, "0") + ":" +
		String(time.getMinutes()).padStart(2, "0") + ":" +
		String(time.getSeconds()).padStart(2, "0") + "][" + level + "] " +
		msg + "\n" + (err.stack || "")

	msg = msg.trim()

	let pth = Constants.logPath

	fs.stat(pth, (err: Error, stat) => {
		if (stat && stat.size > 200000) {
			fs.unlink(pth, () => {
				fs.appendFile(pth, msg + "\n", (err: Error): void => {
					if (err) {
						err = new Errors.WriteError(err, "Günlükçü: Günlük yazılamadı",
							{log_path: pth})
						console.error(err)
					}
				})
			})
		} else {
			fs.appendFile(pth, msg + "\n", (err: Error): void => {
				if (err) {
					err = new Errors.WriteError(err, "Günlükçü: Günlük yazılamadı",
						{log_path: pth})
					console.error(err)
				}
			})
		}
	})
}

export function info(err: any): void {
	push("INFO", err)
}

export function warning(err: any): void {
	push("WARN", err)
}

export function error(err: any): void {
	push("ERROR", err)
}
