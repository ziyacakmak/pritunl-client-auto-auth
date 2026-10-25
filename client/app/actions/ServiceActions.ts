/// <reference path="../References.d.ts"/>
import * as ProfileTypes from "../types/ProfileTypes"
import * as RequestUtils from "../utils/RequestUtils"
import * as Errors from "../Errors";
import * as Logger from "../Logger";
import * as Request from "../Request"
import Loader from "../Loader"
import * as Alert from "../Alert";

export function connect(prfl: ProfileTypes.ProfileData,
	noLoading?: boolean): Promise<void> {

	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	return new Promise<void>((resolve): void => {
		RequestUtils
			.post('/profile')
			.timeout(120)
			.set('Accept', 'application/json')
			.send(prfl)
			.end()
			.then((resp: Request.Response) => {
				if (loader) {
					loader.done()
				}

				resolve()
			}, (err) => {
				if (loader) {
					loader.done()
				}

				err = new Errors.RequestError(err,
					"Profiller: Profile bağlanılamadı")
				Logger.errorAlert(err)

				resolve()
				return
			})
	})
}

export function disconnect(prfl: ProfileTypes.ProfileData,
	noLoading?: boolean): Promise<void> {

	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	return new Promise<void>((resolve): void => {
		RequestUtils
			.del('/profile/' + prfl.id)
			.end()
			.then((resp: Request.Response) => {
				if (loader) {
					loader.done()
				}

				resolve()
			}, (err) => {
				if (loader) {
					loader.done()
				}

				err = new Errors.RequestError(err,
					"Profiller: Profil bağlantısı kesilemedi")
				Logger.errorAlert(err)

				resolve()
				return
			})
	})
}

export async function tokenUpdate(prfl: ProfileTypes.Profile,
	noLoading?: boolean): Promise<boolean> {

	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	let valid = false

	let serverPubKey = ""
	if (prfl.server_public_key) {
		serverPubKey = prfl.server_public_key.join("\n")
	}

	try {
		let resp = await RequestUtils
			.put('/token')
			.set('Accept', 'application/json')
			.send({
				profile: prfl.id,
				server_public_key: serverPubKey,
				server_box_public_key: prfl.server_box_public_key,
				ttl: prfl.token_ttl,
			})
			.end()
		if (resp.status !== 200) {
			let err = new Errors.RequestError(null,
				"Profiller: Belirteç güncelleme isteği hatası " + resp.status)
			Logger.errorAlert(err, 10)
		} else {
			let data = resp.jsonPassive()
			if (data) {
				valid = !!data.valid
			}
		}
	} catch (err) {
		err = new Errors.RequestError(
			err, "Profiller: Belirteç güncelleme isteği başarısız")
		Logger.errorAlert(err, 10)
	}

	if (loader) {
		loader.done()
	}

	return valid
}

export async function tokenDelete(prfl: ProfileTypes.Profile,
	noLoading?: boolean): Promise<void> {

	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	try {
		await RequestUtils
			.del('/token/' + prfl.id)
			.end()
	} catch (err) {
		err = new Errors.RequestError(
			err, "Profiller: Belirteç güncelleme isteği başarısız")
		Logger.errorAlert(err, 10)
	}

	if (loader) {
		loader.done()
	}
}

export function resetDns(noLoading?: boolean): Promise<void> {
	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	return new Promise<void>((resolve): void => {
		RequestUtils
			.post("/network/reset_dns")
			.set("Accept", "application/json")
			.end()
			.then((resp: Request.Response) => {
				if (loader) {
					loader.done()
				}

				if (resp.status !== 200) {
					let err = new Errors.RequestError(null,
						"Sistem: DNS sıfırlanamadı", {
							status: resp.status.toString()
						})
					Logger.errorAlert(err)
					return
				}

				Alert.success("Sistem: DNS sıfırlandı")

				resolve()
			}, (err) => {
				if (loader) {
					loader.done()
				}

				err = new Errors.RequestError(err,
					"Sistem: DNS sıfırlanamadı")
				Logger.errorAlert(err)

				resolve()
				return
			})
	})
}

export function resetAll(noLoading?: boolean): Promise<void> {
	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	return new Promise<void>((resolve): void => {
		RequestUtils
			.post("/network/reset_all")
			.set("Accept", "application/json")
			.end()
			.then((resp: Request.Response) => {
				if (loader) {
					loader.done()
				}

				if (resp.status !== 200) {
					let err = new Errors.RequestError(null,
						"Sistem: Ağ ayarları sıfırlanamadı", {
							status: resp.status.toString()
						})
					Logger.errorAlert(err)
					return
				}

				Alert.success("Sistem: Ağ ayarları sıfırlandı")

				resolve()
			}, (err) => {
				if (loader) {
					loader.done()
				}

				err = new Errors.RequestError(err,
					"Sistem: Ağ ayarları sıfırlanamadı")
				Logger.errorAlert(err)

				resolve()
				return
			})
	})
}

export function resetEnclave(noLoading?: boolean): Promise<void> {
	let loader: Loader
	if (!noLoading) {
		loader = new Loader().loading()
	}

	return new Promise<void>((resolve): void => {
		RequestUtils
			.post("/reset_enclave")
			.set("Accept", "application/json")
			.end()
			.then((resp: Request.Response) => {
				if (loader) {
					loader.done()
				}

				if (resp.status !== 200) {
					let err = new Errors.RequestError(null,
						"Sistem: Güvenli Alan anahtarı sıfırlanamadı", {
							status: resp.status.toString()
						})
					Logger.errorAlert(err)
					return
				}

				Alert.success("Sistem: Güvenli Alan anahtarı sıfırlandı")

				resolve()
			}, (err) => {
				if (loader) {
					loader.done()
				}

				err = new Errors.RequestError(err,
					"Sistem: Güvenli Alan anahtarı sıfırlanamadı")
				Logger.errorAlert(err)

				resolve()
				return
			})
	})
}
