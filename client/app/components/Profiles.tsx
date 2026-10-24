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
		this.setState({
			profiles: ProfilesStore.profiles,
			zeros: ZerosStore.zeros,
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
