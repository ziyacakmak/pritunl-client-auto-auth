/// <reference path="../References.d.ts"/>
import Electron from "electron"
import os from "os"
import * as React from "react"
import Dispatcher from '../dispatcher/Dispatcher';
import EventDispatcher from '../dispatcher/EventDispatcher';
import * as Alert from '../Alert';
import * as Paths from '../Paths';
import Loader from '../Loader';
import * as ProfileTypes from '../types/ProfileTypes';
import * as ChartTypes from '../types/ChartTypes';
import ProfilesStore from '../stores/ProfilesStore';
import * as MiscUtils from '../utils/MiscUtils';
import * as RequestUtils from '../utils/RequestUtils';
import fs from "fs";
import path from "path";
import * as Errors from "../Errors";
import * as Logger from "../Logger";
import * as Request from "../Request"

const css = {
	updateButton: {
		marginTop: "7px",
	} as React.CSSProperties,
}

let syncId: string;

function loadSystemProfiles(): Promise<ProfileTypes.Profiles> {
	return new Promise<ProfileTypes.Profiles>((resolve): void => {
		RequestUtils
			.get('/sprofile')
			.set('Accept', 'application/json')
			.end()
			.then((resp: Request.Response) => {
				if (resp.status !== 200) {
					let err = new Errors.ReadError(
						null, "Profiller: Hizmet profilleri yüklenemedi",
						{body: resp.data})
					Logger.error(err)
					resolve([])
					return
				}
				resolve(resp.json() as ProfileTypes.Profiles)
			}, (err) => {
				err = new Errors.RequestError(err,
					"Profiller: Hizmet yükleme hatası")
				Logger.errorAlert2(err)
				resolve([])
				return
			})
	})
}

function loadProfile(prflId: string,
		prflPath: string): Promise<ProfileTypes.Profile> {

	let ovpnPath = prflPath.substring(0, prflPath.length-5) + ".ovpn"
	let logPath = prflPath.substring(0, prflPath.length-5) + ".log"

	return new Promise<ProfileTypes.Profile>((resolve, reject): void => {
		if (os.platform() !== "win32") {
			fs.stat(
				prflPath,
				function(err: NodeJS.ErrnoException, stats: fs.Stats) {
					if (err && err.code === "ENOENT") {
						return
					}

					let mode: string
					try {
						mode = (stats.mode & 0o777).toString(8);
					} catch (err) {
						err = new Errors.ReadError(
							err, "Profiller: Profil bilgisi alınamadı",
							{profile_path: prflPath})
						Logger.errorAlert(err)
						return
					}
					if (mode !== "600") {
						fs.chmod(prflPath, 0o600, function(err) {
							if (err) {
								err = new Errors.ReadError(
									err, "Profiller: Profil bilgisi alınamadı",
									{profile_path: prflPath})
								Logger.errorAlert(err)
							}
						});
					}
				},
			);
			fs.stat(
				ovpnPath,
				function(err: NodeJS.ErrnoException, stats: fs.Stats) {
					if (err && err.code === "ENOENT") {
						return
					}

					let mode: string
					try {
						mode = (stats.mode & 0o777).toString(8);
					} catch (err) {
						err = new Errors.ReadError(
							err, "Profiller: OVPN profil bilgisi alınamadı",
							{profile_ovpn_path: ovpnPath})
						Logger.errorAlert(err)
						return
					}

					if (mode !== "600") {
						fs.chmod(ovpnPath, 0o600, function(err) {
							if (err) {
								err = new Errors.ReadError(
									err, "Profiller: OVPN profil bilgisi alınamadı",
									{profile_ovpn_path: ovpnPath})
								Logger.errorAlert(err)
							}
						});
					}
				},
			);
			fs.stat(
				logPath,
				function(err: NodeJS.ErrnoException, stats: fs.Stats) {
					if (err && err.code === "ENOENT") {
						return
					}

					let mode: string
					try {
						mode = (stats.mode & 0o777).toString(8);
					} catch (err) {
						err = new Errors.ReadError(
							err, "Profiller: Profil günlük bilgisi alınamadı",
							{profile_log_path: logPath})
						Logger.errorAlert(err)
						return
					}

					if (mode !== "600") {
						fs.chmod(logPath, 0o600, function(err) {
							if (err) {
								err = new Errors.ReadError(
									err, "Profiller: Profil günlük bilgisi alınamadı",
									{profile_log_path: logPath})
								Logger.errorAlert(err)
							}
						});
					}
				},
			);
		}

		fs.readFile(
			prflPath, "utf-8",
			(err: NodeJS.ErrnoException, data: string): void => {
				if (err) {
					err = new Errors.ReadError(
						err, "Profiller: Profil okunamadı",
						{profile_log_path: logPath})
					reject(err)
					return
				}

				let prfl: ProfileTypes.Profile
				try {
					prfl = JSON.parse(data)
					prfl.id = prflId
				} catch (err) {
					err = new Errors.ParseError(err,
						"Profiller: Profil yapılandırması ayrıştırılamadı",
						{profile_path: prflPath})
					reject(err)
					return
				}

				fs.readFile(
					ovpnPath, "utf-8",
					(err: NodeJS.ErrnoException, data: string): void => {
						if (err) {
							err = new Errors.ReadError(
								err, "Profiller: Profil okunamadı",
								{profile_log_path: logPath})
							reject(err)
							return
						}

						prfl.ovpn_data = data

						resolve(prfl)
					},
				)
			},
		)
	});
}

function loadProfiles(): Promise<ProfileTypes.Profiles> {
	return new Promise<ProfileTypes.Profiles>((resolve): void => {
		let profilesPath = Paths.profiles();

		fs.stat(
			profilesPath,
			(err: NodeJS.ErrnoException, stats: fs.Stats): void => {
				if (err) {
					if (err.code !== "ENOENT") {
						err = new Errors.ReadError(err, "Profiller: Okuma hatası",
							{profiles_path: profilesPath});
						Logger.errorAlert(err);
					}

					resolve([]);
					return;
				}

				fs.readdir(
					profilesPath,
					async (err: NodeJS.ErrnoException, filenames: string[]) => {
						if (err) {
							err = new Errors.ReadError(err, "Profiller: Okuma hatası",
								{profiles_path: profilesPath});
							Logger.errorAlert(err);

							resolve([]);
							return;
						}

						let prfls: ProfileTypes.Profiles = [];
						for (let filename of filenames) {
							if (!filename.endsWith('.conf')) {
								continue;
							}

							let prflPath = path.join(profilesPath, filename);
							let prflId = filename.split(".")[0]

							let prfl: ProfileTypes.Profile;
							try {
								prfl = await loadProfile(prflId, prflPath);
							} catch(err) {
								Logger.error(err)
							}

							if (prfl) {
								prfls.push(prfl);
							}
						}

						resolve(prfls);
						return;
					},
				);
			},
		);
	});
}

function loadProfilesState(): Promise<ProfileTypes.ProfilesMap> {
	return new Promise<ProfileTypes.ProfilesMap>((resolve): void => {
		RequestUtils
			.get('/profile')
			.set('Accept', 'application/json')
			.end()
			.then((resp: Request.Response) => {
				resolve(resp.json() as ProfileTypes.ProfilesMap)
			}, (err) => {
				err = new Errors.RequestError(err,
					"Profiller: Durum hatası")
				Logger.errorAlert2(err)
				resolve({})
				return
			})
	});
}

export function sync(noLoading?: boolean): Promise<void> {
	let curSyncId = MiscUtils.uuid();
	syncId = curSyncId;

	let loader: Loader;
	if (!noLoading) {
		loader = new Loader().loading();
	}

	return new Promise<void>((resolve): void => {
		loadProfiles().then((prfls: ProfileTypes.Profiles): void => {
			if (loader) {
				loader.done();
			}

			if (curSyncId !== syncId) {
				resolve();
				return;
			}

			loadSystemProfiles().then((systemPrfls: ProfileTypes.Profiles) => {
				loadProfilesState().then((prflsState: ProfileTypes.ProfilesMap) => {
					Dispatcher.dispatch({
						type: ProfileTypes.SYNC_ALL,
						data: {
							profiles: prfls,
							profilesState: prflsState,
							profilesSystem: systemPrfls,
							count: prfls.length,
						},
					});

					resolve();
				})
			})
		});
	});
}

export function traverse(page: number): Promise<void> {
	Dispatcher.dispatch({
		type: ProfileTypes.TRAVERSE,
		data: {
			page: page,
		},
	});

	return sync();
}

export function filter(filt: ProfileTypes.Filter): Promise<void> {
	Dispatcher.dispatch({
		type: ProfileTypes.FILTER,
		data: {
			filter: filt,
		},
	});

	return sync();
}

export function chart(prflId: string, resource: string, period: number,
		interval: number): Promise<ChartTypes.ProfileData> {

	return new Promise<ChartTypes.ProfileData>((resolve, reject): void => {
		RequestUtils
			.get('/profile/' + prflId + '/chart?resource=' + resource +
				'&period=' + period + '&interval=' + interval)
			.set('Accept', 'application/json')
			.end()
			.then((resp: Request.Response) => {
				if (resp.status !== 200) {
					let err = new Errors.ReadError(
						null, "Profiller: Profil grafiği yüklenemedi",
						{body: resp.data})
					Logger.errorAlert2(err)
					reject(err)
					return
				}
				resolve(resp.json() as ChartTypes.ProfileData)
			}, (err) => {
				err = new Errors.RequestError(err,
					"Profiller: Grafik yükleme hatası")
				Logger.errorAlert2(err)
				reject(err)
				return
			})
	})
}

export function commit(prfl: ProfileTypes.Profile): Promise<void> {
	return new Promise<void>((resolve): void => {
		prfl.writeConf().then(() => {
			sync()
			resolve()
		})
	})
}

EventDispatcher.register((action: ProfileTypes.ProfileDispatch) => {
	switch (action.type) {
		case "update":
			sync(true)
			break
		case "auth_error":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Kimlik doğrulanamadı: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("Kimlik doğrulama başarısız oldu")
			break
		case "flatpak_tpm_missing":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Flatpak'te cihaz doğrulaması için TPM erişimi " +
						"yok: " + prfl.formattedName() +
						". Cihaz doğrulaması için Flatpak'ın cihaz erişimine " +
						"sahip olması gerekir.")
					return
				}
			}
			Alert.error("Flatpak'te cihaz doğrulaması için TPM erişimi yok. " +
				"Cihaz doğrulaması için Flatpak'ın cihaz erişimine sahip " +
				"olması gerekir.")
			break
		case "flatpak_tpm_unauthorized":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Cihaz doğrulaması için TPM'e erişim izni " +
						"reddedildi: " + prfl.formattedName() +
						". Flatpak TPM cihazına erişebiliyor ancak açma izni " +
						"yok. Erişim sağlamak için udev kurallarını " +
						"güncelleyin.")
					return
				}
			}
			Alert.error("Cihaz doğrulaması için TPM'e erişim izni reddedildi. " +
				"Flatpak TPM cihazına erişebiliyor ancak açma izni yok. " +
				"Erişim sağlamak için udev kurallarını güncelleyin.")
			break
		case "inactive":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Hareketsizlik nedeniyle bağlantı kesildi: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("Hareketsizlik nedeniyle bağlantı kesildi")
			break
		case "timeout_error":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Bağlantı zaman aşımına uğradı: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("Bağlantı zaman aşımına uğradı")
			break
		case "offline_error":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Sunucu çevrimdışı: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("Bağlantı zaman aşımına uğradı")
			break
		case "connection_error":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Bağlanılamadı: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("Bağlantı kurulamadı")
			break
		case "handshake_timeout":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("El sıkışma zaman aşımı: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("El sıkışma zaman aşımı")
			break
		case "configuration_error":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					Alert.error("Yapılandırma hatası: " +
						prfl.formattedName())
					return
				}
			}
			Alert.error("El sıkışma zaman aşımı")
			break
		case "sso_auth":
			let ssoAuthMsg = "Bağlantı tek oturum açma kimlik doğrulaması " +
				"gerektiriyor. Kimlik doğrulamayı web tarayıcısında tamamlayın. " +
				"Tarayıcı açılmadıysa aşağıdaki bağlantıyı kopyalayın."

			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					ssoAuthMsg = "\"" + prfl.formattedName() + "\" bağlantısı " +
						"tek oturum açma kimlik doğrulaması gerektiriyor. Kimlik " +
						"doğrulamayı web tarayıcısında tamamlayın. Tarayıcı " +
						"açılmadıysa aşağıdaki bağlantıyı kopyalayın."
				}
			}

			let ssoAuthElm: JSX.Element = <div>
				<div>{ssoAuthMsg}</div>
				<button
					className="bp5-button bp5-intent-primary bp5-icon-link"
					type="button"
					style={css.updateButton}
					onClick={(evt): void => {
						Electron.ipcRenderer.send("control", "copy", action.data.url)
						evt.currentTarget.className = "bp5-button bp5-intent-success " +
							"bp5-icon-link"
						evt.currentTarget.innerText = "Bağlantı Kopyalandı"
					}}
				>Tek Oturum Açma Bağlantısını Kopyala</button>
			</div>

			Alert.info(ssoAuthElm, 5)
			break
		case "registration_required":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					if (!prfl.system) {
						prfl.registration_key = action.data.registration_key
						prfl.writeConf()
					}

					Alert.error("Cihaz kaydı gerekli: " +
						prfl.formattedName())

					return
				}
			}
			Alert.error("Kimlik doğrulama başarısız oldu")
			break
		case "registration_pass":
			if (action.data) {
				let prfl = ProfilesStore.profile(action.data.id)
				if (prfl) {
					if (!prfl.system && prfl.registration_key) {
						prfl.registration_key = ""
						prfl.writeConf()
					}

					return
				}
			}
			break
	}
});
