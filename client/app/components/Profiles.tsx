/// <reference path="../References.d.ts"/>
import * as React from 'react'
import ProfilesStore from '../stores/ProfilesStore'
import * as ProfileTypes from '../types/ProfileTypes'
import * as ProfileActions from '../actions/ProfileActions'
import ZerosStore from '../stores/ZerosStore'
import * as ZeroTypes from '../types/ZeroTypes'
import * as ZeroActions from '../actions/ZeroActions'
import Profile from "./Profile"
import Zero from "./Zero"
import * as AutoAuth from '../utils/AutoAuth'
import * as ConnectUtils from '../utils/ConnectUtils'

interface State {
	profiles: ProfileTypes.ProfilesRo
	zeros: ZeroTypes.ZerosRo
	windowWidth: number
}

const profilesStyle = `
.profiles-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 0;
	margin: 8px 0 0 8px;
}
@media (min-width: 864px) {
	.profiles-grid {
		grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
	}
}
`

export default class Profiles extends React.Component<{}, State> {
	interval: NodeJS.Timeout
	autoConnectDone: boolean

	constructor(props: any, context: any) {
		super(props, context)
		this.state = {
			profiles: ProfilesStore.profiles,
			zeros: ZerosStore.zeros,
			windowWidth: document.documentElement.clientWidth,
		}
	}

	componentDidMount(): void {
		ProfilesStore.addChangeListener(this.onChange)
		ZerosStore.addChangeListener(this.onChange)
		ProfileActions.sync()
		ZeroActions.sync()
		window.addEventListener('resize', this.onResize)

		this.interval = setInterval(() => {
			ProfileActions.sync(true)
			ZeroActions.sync(true)
		}, 1000)
	}

	componentWillUnmount(): void {
		ProfilesStore.removeChangeListener(this.onChange)
		ZerosStore.removeChangeListener(this.onChange)
		window.removeEventListener('resize', this.onResize)

		clearInterval(this.interval)
	}

	onResize = (): void => {
		this.setState({
			windowWidth: document.documentElement.clientWidth,
		})
	}

	onChange = (): void => {
		let profiles = ProfilesStore.profiles

		this.setState({
			profiles: profiles,
			zeros: ZerosStore.zeros,
		})

		if (!this.autoConnectDone && profiles.length) {
			this.autoConnectDone = true
			setTimeout(this.autoConnect, 2000)
		}
	}

	autoConnect = (): void => {
		this.state.profiles.forEach((prfl: ProfileTypes.ProfileRo): void => {
			if (prfl.status !== "disconnected") {
				return
			}

			AutoAuth.load(prfl.id).then((auto): void => {
				if (!auto.enabled || !auto.auto_connect) {
					return
				}

				let mode = "ovpn"
				if (prfl.wg && prfl.last_mode === "wg") {
					mode = "wg"
				}

				ConnectUtils.connectAuto(prfl, mode)
			})
		})
	}

	render(): JSX.Element {
		let profilesDom: JSX.Element[] = []

		let profilesCount = this.state.profiles.length +
			this.state.zeros.length
		let minimal = profilesCount > 3 && this.state.windowWidth < 864
		let prflIds: Set<string> = new Set()
		let zeroIds: Set<string> = new Set()

		this.state.profiles.forEach((prfl: ProfileTypes.ProfileRo): void => {
			if (prflIds.has(prfl.id)) {
				return
			}
			prflIds.add(prfl.id)

			profilesDom.push(<Profile
				key={prfl.id}
				profile={prfl}
				minimal={minimal}
			/>)
		})

		this.state.zeros.forEach((zero: ZeroTypes.ZeroRo): void => {
			if (zeroIds.has(zero.id)) {
				return
			}
			zeroIds.add(zero.id)

			profilesDom.push(<Zero
				key={"zero-" + zero.id}
				zero={zero}
				minimal={minimal}
			/>)
		})

		return <div>
			<style>{profilesStyle}</style>
			<div className="profiles-grid">
				{profilesDom}
			</div>
		</div>
	}
}
