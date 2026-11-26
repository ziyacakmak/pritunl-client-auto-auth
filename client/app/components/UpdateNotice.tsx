/// <reference path="../References.d.ts"/>
import * as React from "react"
import * as Electron from "electron"
import * as UpdateUtils from "../utils/UpdateUtils"

export type Phase = "idle" | "downloading" | "verifying" | "downloaded" |
	"installing" | "error"

export interface State {
	phase: Phase
	tag: string
	percent: number
	received: number
	total: number
	message: string
}

interface Props {
	update: UpdateUtils.Update
	onDismiss: () => void
}

const css = {
	title: {
		marginBottom: "2px",
	} as React.CSSProperties,
	meta: {
		opacity: 0.8,
		marginBottom: "4px",
	} as React.CSSProperties,
	bar: {
		height: "6px",
		borderRadius: "3px",
		overflow: "hidden",
		margin: "7px 0 3px 0",
		backgroundColor: "rgba(255, 255, 255, 0.2)",
	} as React.CSSProperties,
	barFill: {
		height: "100%",
		backgroundColor: "#2d72d2",
		transition: "width 200ms linear",
	} as React.CSSProperties,
	size: {
		fontSize: "12px",
		opacity: 0.8,
	} as React.CSSProperties,
	message: {
		marginTop: "4px",
	} as React.CSSProperties,
	button: {
		marginTop: "7px",
	} as React.CSSProperties,
	buttonSecond: {
		marginTop: "7px",
		marginLeft: "5px",
	} as React.CSSProperties,
}

function formatSize(bytes: number): string {
	if (!bytes) {
		return "0 MB"
	}

	let mb = bytes / (1024 * 1024)

	if (mb >= 1) {
		return Math.round(mb) + " MB"
	}

	return Math.round(bytes / 1024) + " KB"
}

export default class UpdateNotice extends React.Component<Props, State> {
	constructor(props: Props, context: any) {
		super(props, context)

		this.state = {
			phase: "idle",
			tag: this.props.update.latest.label,
			percent: 0,
			received: 0,
			total: 0,
			message: "",
		}
	}

	componentDidMount(): void {
		Electron.ipcRenderer.on("event.update-state", this.onState)
		this.refresh()
	}

	componentWillUnmount(): void {
		Electron.ipcRenderer.removeListener("event.update-state", this.onState)
	}

	target(): {tag: string, asset: UpdateUtils.Asset | null} {
		return {
			tag: this.props.update.latest.label,
			asset: this.props.update.asset,
		}
	}

	onState = (evt: Electron.IpcRendererEvent, state: State): void => {
		if (!state || !state.phase) {
			return
		}

		this.setState(state)
	}

	refresh = (): void => {
		Electron.ipcRenderer.invoke("update", "status", this.target()).then(
			(result: [string | null, State]): void => {
				if (result && result[1] && result[1].phase) {
					this.setState(result[1])
				}
			}, (): void => {})
	}

	download = (): void => {
		Electron.ipcRenderer.invoke("update", "start", this.target()).then(
			(result: [string | null, State]): void => {
				if (result && result[1] && result[1].phase) {
					this.setState(result[1])
				}
			}, (): void => {})
	}

	cancel = (): void => {
		Electron.ipcRenderer.invoke("update", "cancel").then(
			(): void => {}, (): void => {})
	}

	install = (): void => {
		Electron.ipcRenderer.invoke("update", "install", this.target()).then(
			(result: [string | null, State]): void => {
				if (result && result[1] && result[1].phase) {
					this.setState(result[1])
				}
			}, (): void => {})
	}

	manual = (): void => {
		Electron.ipcRenderer.send("control", "download-update")
	}

	renderManual(): JSX.Element {
		return <button
			className="bp5-button bp5-minimal"
			type="button"
			style={css.buttonSecond}
			onClick={this.manual}
		>Elle İndir</button>
	}

	renderBody(): JSX.Element {
		let update = this.props.update
		let state = this.state

		if (!update.installable) {
			return <div>
				<div style={css.message}>
					Bu sürüm otomatik kurulamıyor, dosyayı elle indirin.
				</div>
				{this.renderManual()}
				<button
					className="bp5-button bp5-minimal"
					type="button"
					style={css.buttonSecond}
					onClick={this.props.onDismiss}
				>Daha Sonra</button>
			</div>
		}

		if (state.phase === "downloading") {
			return <div>
				<div style={css.message}>İndiriliyor… %{state.percent}</div>
				<div style={css.bar}>
					<div style={{
						...css.barFill,
						width: state.percent + "%",
					}}/>
				</div>
				<div style={css.size}>
					{formatSize(state.received)} / {formatSize(state.total)}
				</div>
				<button
					className="bp5-button bp5-minimal"
					type="button"
					style={css.button}
					onClick={this.cancel}
				>İptal</button>
			</div>
		}

		if (state.phase === "verifying") {
			return <div>
				<div style={css.message}>
					İndirilen dosya doğrulanıyor…
				</div>
			</div>
		}

		if (state.phase === "downloaded") {
			let size = state.total ? formatSize(state.total) : ""

			return <div>
				<div style={css.message}>
					İndirildi ve doğrulandı{size ? " (" + size + ")" : ""}.
				</div>
				<button
					className="bp5-button bp5-intent-primary bp5-icon-cloud-upload"
					type="button"
					style={css.button}
					onClick={this.install}
				>Kur</button>
				<button
					className="bp5-button bp5-minimal"
					type="button"
					style={css.buttonSecond}
					onClick={this.props.onDismiss}
				>Daha Sonra</button>
			</div>
		}

		if (state.phase === "installing") {
			return <div>
				<div style={css.message}>
					{state.message || "Kuruluyor…"}
				</div>
				<div style={css.size}>
					Uygulama kapanıp yeniden açılacak.
				</div>
			</div>
		}

		if (state.phase === "error") {
			return <div>
				<div style={css.message}>
					{state.message || "Güncelleme tamamlanamadı."}
				</div>
				<button
					className="bp5-button bp5-intent-primary bp5-icon-refresh"
					type="button"
					style={css.button}
					onClick={this.download}
				>Tekrar Dene</button>
				{this.renderManual()}
			</div>
		}

		return <div>
			<button
				className="bp5-button bp5-intent-primary bp5-icon-download"
				type="button"
				style={css.button}
				onClick={this.download}
			>İndir</button>
			<button
				className="bp5-button bp5-minimal"
				type="button"
				style={css.buttonSecond}
				onClick={this.props.onDismiss}
			>Daha Sonra</button>
		</div>
	}

	render(): JSX.Element {
		let update = this.props.update

		return <div>
			<div style={css.title}>
				<b>Yeni sürüm: {update.latest.label}</b>
			</div>
			<div style={css.meta}>Kullanılan sürüm: {update.current.label}</div>
			{this.renderBody()}
		</div>
	}
}
