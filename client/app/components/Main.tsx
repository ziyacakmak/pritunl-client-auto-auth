/// <reference path="../References.d.ts"/>
import * as React from 'react';
import * as Electron from "electron";
import * as Theme from '../Theme';
import Config from '../Config';
import * as Constants from '../Constants';
import * as ProfileActions from '../actions/ProfileActions';
import * as ServiceActions from '../actions/ServiceActions';
import * as ConfigActions from '../actions/ConfigActions';
import ProfileImport from "./ProfileImport";
import LoadingBar from './LoadingBar';
import Profiles from './Profiles';
import Logs from './Logs';
import ConfigView from './Config';
import About from './About';
import * as Blueprint from "@blueprintjs/core";
import * as Alert from "../Alert";
import * as UpdateUtils from "../utils/UpdateUtils";

const updateCheckInterval = 6 * 60 * 60 * 1000

let updateTimer: number
let updateShown = ""

interface State {
	path: string
	disabled: boolean
	menu: boolean
	about: boolean
	showErrors: boolean
}

const css = {
	card: {
		minWidth: '310px',
		maxWidth: '380px',
		width: 'calc(100% - 20px)',
		margin: '60px auto',
	} as React.CSSProperties,
	nav: {
		overflowX: 'auto',
		overflowY: 'auto',
		userSelect: 'none',
		height: '38px',
		padding: '0 4px 0 8px',
	} as React.CSSProperties,
	navTitle: {
		flexWrap: 'wrap',
		height: 'auto',
	} as React.CSSProperties,
	navGroup: {
		flexWrap: 'wrap',
		height: 'auto',
		padding: '4px 0',
	} as React.CSSProperties,
	link: {
		padding: '0 7px',
		marginLeft: '3px',
	} as React.CSSProperties,
	sub: {
		color: 'inherit',
	} as React.CSSProperties,
	heading: {
		fontFamily: "'Fredoka One', cursive",
		marginTop: '-3px',
		marginRight: '2px',
		fontSize: '26px',
	} as React.CSSProperties,
	headingDarwin: {
		fontFamily: "'Fredoka One', cursive",
		marginTop: '-3px',
		marginLeft: '77px',
		marginRight: '2px',
		fontSize: '26px',
	} as React.CSSProperties,
	loading: {
		position: 'absolute',
		top: '36px',
		width: '100%',
		zIndex: '100',
	} as React.CSSProperties,
	container: {
		height: '100%',
	} as React.CSSProperties,
	content: {
		overflowY: 'auto',
	} as React.CSSProperties,
	contentLinux: {
		overflowY: 'auto',
		marginRight: '1px',
	} as React.CSSProperties,
	menuHeader: {
		margin: '7px 0',
		paddingLeft: '0',
	} as React.CSSProperties,
	menuLabel: {
		fontSize: '15px',
		textAlign: 'center',
		padding: '0',
	} as React.CSSProperties,
	updateButton: {
		marginTop: "7px",
	} as React.CSSProperties,
	updateDismissButton: {
		marginTop: "7px",
		marginLeft: "5px",
	} as React.CSSProperties,
	controlButtonFirst: {
		marginLeft: '4px',
	} as React.CSSProperties,
	controlButtonFirstDarwin: {
		borderRadius: "10px",
		marginLeft: '4px',
	} as React.CSSProperties,
	controlButton: {
		marginLeft: '3px',
	} as React.CSSProperties,
	controlButtonDarwin: {
		borderRadius: "10px",
		marginLeft: '3px',
	} as React.CSSProperties,
};

export default class Main extends React.Component<{}, State> {
	constructor(props: any, context: any) {
		super(props, context);
		this.state = {
			path: "/",
			disabled: false,
			menu: false,
			about: false,
			showErrors: false,
		}
	}

	componentDidMount(): void {
		Constants.addChangeListener(this.onChange)
		Alert.addChangeListener(this.onAlert)

		this.checkUpdate()
		updateTimer = window.setInterval(
			this.checkUpdate, updateCheckInterval)
	}

	componentWillUnmount(): void {
		Constants.removeChangeListener(this.onChange)
		Alert.removeChangeListener(this.onAlert)

		if (updateTimer) {
			window.clearInterval(updateTimer)
			updateTimer = null
		}
	}

	onChange = (): void => {
		this.setState({
			...this.state,
		})
	}

	onRefresh = (): void => {
		let pathname = "";

		this.setState({
			...this.state,
			disabled: true,
		});

		if (pathname === '/profiles') {
			ProfileActions.sync().then((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			}).catch((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			});
		} else if (pathname === '/logs') {
			ProfileActions.sync().then((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			}).catch((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			});
		} else if (pathname === '/config') {
			ConfigActions.sync().then((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			}).catch((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			});
		} else {
			ProfileActions.sync().then((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			}).catch((): void => {
				this.setState({
					...this.state,
					disabled: false,
				});
			});
		}
	}

	onTrayIcon = async (): Promise<void> => {
		Config.disable_tray_icon = !Config.disable_tray_icon
		await Config.save({
			disable_tray_icon: Config.disable_tray_icon,
		})

		if (Config.disable_tray_icon) {
			Alert.success("Tepsi simgesi devre dışı bırakıldı. " +
				"Değişikliğin uygulanması için istemciyi yeniden başlatın.")
		} else {
			Alert.success("Tepsi simgesi etkinleştirildi. " +
				"Değişikliğin uygulanması için istemciyi yeniden başlatın.")
		}
	}

	frameless(): boolean {
		if (Config.frameless === null) {
			return Constants.frameless
		}
		return Config.frameless
	}

	onWindowFrame = async (): Promise<void> => {
		Config.frameless = !this.frameless()
		await Config.save({
			frameless: Config.frameless,
		})

		if (Config.frameless) {
			Alert.success("Pencere çerçevesi devre dışı bırakıldı. " +
				"Değişikliğin uygulanması için istemciyi yeniden başlatın.")
		} else {
			Alert.success("Pencere çerçevesi etkinleştirildi. " +
				"Değişikliğin uygulanması için istemciyi yeniden başlatın.")
		}
	}

	onAlert = (toasts: number): void => {
		if (!toasts) {
			document.getElementById("toaster2").style.display = "none"
		}

		this.setState({
			...this.state,
			showErrors: !!toasts,
		})
	}

	checkUpdate = (): void => {
		UpdateUtils.check().then((update: UpdateUtils.Update): void => {
			if (!update || update.latest.label === updateShown) {
				return
			}

			updateShown = update.latest.label
			this.showUpdate(update)
		}).catch((): void => {})
	}

	showUpdate = (update: UpdateUtils.Update): void => {
		let updateKey = ""
		let updateElm: JSX.Element = <div>
			<div><b>Yeni bir sürüm mevcut: {update.latest.label}</b></div>
			<div>Kullanılan sürüm: {update.current.label}</div>
			<button
				className="bp5-button bp5-intent-primary bp5-icon-download"
				type="button"
				style={css.updateButton}
				onClick={(): void => {
					Alert.dismiss(updateKey)
					Electron.ipcRenderer.send("control", "download-update")
				}}
			>Güncellemeyi İndir</button>
			<button
				className="bp5-button bp5-minimal"
				type="button"
				style={css.updateDismissButton}
				onClick={(): void => {
					Alert.dismiss(updateKey)
				}}
			>Daha Sonra</button>
		</div>

		updateKey = Alert.info(updateElm, 0)
	}

	render(): JSX.Element {
		let showControls = Constants.frameless && process.platform !== "darwin"

		let themeLabel = ""
		let themeIcon: Blueprint.IconName;
		if (Theme.theme === "dark") {
			themeLabel = "Açık Tema"
			themeIcon = "flash"
		} else {
			themeLabel = "Koyu Tema"
			themeIcon = "moon"
		}

		let themeVerLabel = ""
		let themeVerIcon: Blueprint.IconName;
		if (Theme.themeVer === 3) {
			themeVerLabel = "Köşeli Tema"
			themeVerIcon = "style"
		} else {
			themeVerLabel = "Yuvarlak Tema"
			themeVerIcon = "style"
		}

		let trayLabel = ""
		if (Config.disable_tray_icon) {
			trayLabel = "Tepsi Simgesini Etkinleştir"
		} else {
			trayLabel = "Tepsi Simgesini Devre Dışı Bırak"
		}

		let frameLabel = ""
		if (this.frameless()) {
			frameLabel = "Pencere Çerçevesini Etkinleştir"
		} else {
			frameLabel = "Pencere Çerçevesini Devre Dışı Bırak"
		}

		let profilesHidden = false
		let page: JSX.Element;
		switch (this.state.path) {
			case "/":
				profilesHidden = true
				page = <Profiles/>
				break
			case "/profiles":
				profilesHidden = true
				page = <Profiles/>
				break
			case "/logs":
				page = <Logs
					onClose={() => {
							this.setState({
								...this.state,
								path: "/profiles",
							})
					}}
				/>
				break
			case "/config":
				page = <ConfigView
					onClose={() => {
							this.setState({
								...this.state,
								path: "/profiles",
							})
					}}
				/>
				break
		}

		let version = Constants.state.version
		if (Constants.state.version) {
			version = " v" + Constants.state.version
		}

		let controlButtonStyle = process.platform === "darwin" ?
			css.controlButtonDarwin : css.controlButton

		let menu: JSX.Element = <Blueprint.Menu>
			<li className="bp5-menu-header" style={css.menuHeader}>
				<h6
					className="bp5-heading"
					style={css.menuLabel}
				>{"pritunl++" + version}</h6>
			</li>
			<Blueprint.MenuDivider/>
			<Blueprint.MenuItem
				text={themeLabel}
				icon={themeIcon}
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						Theme.toggle()
						Theme.save()
					}
				}}
				onClick={(): void => {
					Theme.toggle()
					Theme.save()
				}}
			/>
			<Blueprint.MenuItem
				text={themeVerLabel}
				icon={themeVerIcon}
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						Theme.toggleVer()
						Theme.save()
					}
				}}
				onClick={(): void => {
					Theme.toggleVer()
					Theme.save()
				}}
			/>
			<Blueprint.MenuItem
				text="Yenile"
				icon="refresh"
				hidden={true}
				disabled={this.state.disabled}
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.onRefresh()
					}
				}}
				onClick={this.onRefresh}
			/>
			<Blueprint.MenuItem
				text={trayLabel}
				icon="dashboard"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.onTrayIcon()
					}
				}}
				onClick={this.onTrayIcon}
			/>
			<Blueprint.MenuItem
				text={frameLabel}
				icon="application"
				hidden={Constants.platform !== "linux"}
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.onWindowFrame()
					}
				}}
				onClick={this.onWindowFrame}
			/>
			<Blueprint.MenuItem
				text="Günlükleri Görüntüle"
				icon="history"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.setState({
							...this.state,
							path: "/logs",
						})
					}
				}}
				onClick={(): void => {
					this.setState({
						...this.state,
						path: "/logs",
					})
				}}
			/>
			<Blueprint.MenuItem
				text="Uygulamayı Yeniden Yükle"
				icon="refresh"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						Electron.ipcRenderer.send("control", "reload")
					}
				}}
				onClick={(): void => {
					Electron.ipcRenderer.send("control", "reload")
				}}
			/>
			<Blueprint.MenuDivider/>
			<Blueprint.MenuItem
				text="Gelişmiş Ayarlar"
				icon="cog"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.setState({
							...this.state,
							path: "/config",
						})
					}
				}}
				onClick={(): void => {
					this.setState({
						...this.state,
						path: "/config",
					})
				}}
			/>
			<Blueprint.MenuItem
				text="Hakkında"
				icon="info-sign"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						this.setState({
							...this.state,
							about: true,
						})
					}
				}}
				onClick={(): void => {
					this.setState({
						...this.state,
						about: true,
					})
				}}
			/>
			<Blueprint.MenuDivider/>
			<Blueprint.MenuItem
				text="DNS'i Sıfırla"
				intent="warning"
				icon="search"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						ServiceActions.resetDns(false)
					}
				}}
				onClick={(): void => {
					ServiceActions.resetDns(false)
				}}
			/>
			<Blueprint.MenuItem
				text="Ağ Ayarlarını Sıfırla"
				intent="warning"
				icon="globe-network"
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						ServiceActions.resetAll(false)
					}
				}}
				onClick={(): void => {
					ServiceActions.resetAll(false)
				}}
			/>
			<Blueprint.MenuItem
				text="Güvenli Alan Anahtarını Sıfırla"
				intent="danger"
				icon="globe-network"
				hidden={Constants.platform !== "darwin"}
				onKeyDown={(evt): void => {
					if (evt.key === "Enter") {
						ServiceActions.resetEnclave(false)
					}
				}}
				onClick={(): void => {
					ServiceActions.resetEnclave(false)
				}}
			/>
			<Blueprint.MenuItem
				text="Geliştirici Araçları"
				intent="warning"
				icon="code"
				onClick={(): void => {
					Electron.ipcRenderer.send("control", "dev-tools")
				}}
			/>
		</Blueprint.Menu>

		return <div
			style={css.container}
			className={"layout vertical" + (
				(process.platform === "linux" && Constants.frameless) ?
				" container-border" : "")}
		>
			<LoadingBar intent="primary" style={css.loading}/>
			<nav
				className="bp5-navbar layout horizontal"
				style={css.nav}
			>
				<div
					className="bp5-navbar-group bp5-align-left flex webkit-drag"
					style={css.navTitle}
				>
					<div
						className="bp5-navbar-heading"
						style={process.platform === "darwin" ?
							css.headingDarwin : css.heading}
					>pritunl++</div>
				</div>
				<div
					className="bp5-navbar-group bp5-align-right"
					style={css.navGroup}
				>
					<button
						className="bp5-button bp5-minimal bp5-intent-danger bp5-icon-error"
						style={css.link}
						hidden={!this.state.showErrors}
						onClick={() => {
							let elmnt = document.getElementById("toaster2")

							if (elmnt.style.display === "block") {
								elmnt.style.display = "none"
							} else {
								elmnt.style.display = "block"
							}
						}}
					/>
					<button
						className="bp5-button bp5-minimal bp5-icon-people"
						style={css.link}
						hidden={profilesHidden}
						onClick={() => {
							this.setState({
								...this.state,
								path: "/profiles",
							})
						}}
					>
						Profiller
					</button>
					<ProfileImport
						style={css.link}
					/>
					<button
						className="bp5-button bp5-minimal bp5-icon-history"
						hidden={true}
						style={css.link}
						onClick={() => {
							this.setState({
								...this.state,
								path: "/logs",
							})
						}}
					>
						Günlükler
					</button>
					<div>
						<Blueprint.Popover
							interactionKind="click"
							popoverClassName="main-menu"
							placement={Blueprint.Position.BOTTOM}
							content={menu}
							defaultIsOpen={false}
							renderTarget={({isOpen, ...targetProps}) => (
								<Blueprint.Button
									{...targetProps}
									minimal={true}
									icon="menu"
									style={controlButtonStyle}
								/>
							)}
							usePortal={true}
							minimal={true}
						/>
					</div>
					<button
						className="bp5-button bp5-minimal bp5-icon-minus"
						type="button"
						style={controlButtonStyle}
						hidden={!showControls}
						onClick={(): void => {
							Electron.ipcRenderer.send("control", "minimize")
						}}
					/>
					<button
						className="bp5-button bp5-minimal bp5-icon-cross close-button"
						type="button"
						hidden={!showControls}
						style={controlButtonStyle}
						onClick={(): void => {
							window.close()
						}}
					/>
				</div>
			</nav>
			<div className="layout vertical flex" style={
					(process.platform === "linux" && Constants.frameless) ?
					css.contentLinux : css.content}>
				{page}
			</div>
			<About
				isOpen={this.state.about}
				onClose={(): void => {
					this.setState({
						...this.state,
						about: false,
					})
				}}
			/>
		</div>
	}
}
