/// <reference path="../References.d.ts"/>
import Dispatcher from '../dispatcher/Dispatcher';
import EventEmitter from '../EventEmitter';
import * as ZeroTypes from '../types/ZeroTypes';
import * as GlobalTypes from '../types/GlobalTypes';

class ZerosStore extends EventEmitter {
	_zeros: ZeroTypes.Zeros = [];
	_map: {[key: string]: number} = {};
	_token = Dispatcher.register((this._callback).bind(this));

	_reset(): void {
		this._zeros = [];
		this._map = {};
		this.emitChange();
	}

	get zeros(): ZeroTypes.ZerosRo {
		return this._zeros;
	}

	zero(id: string): ZeroTypes.ZeroRo {
		let i = this._map[id];
		if (i === undefined) {
			return null;
		}
		return this._zeros[i];
	}

	emitChange(): void {
		this.emitDefer(GlobalTypes.CHANGE);
	}

	addChangeListener(callback: () => void): void {
		this.on(GlobalTypes.CHANGE, callback);
	}

	removeChangeListener(callback: () => void): void {
		this.removeListener(GlobalTypes.CHANGE, callback);
	}

	_sync(zerosData: ZeroTypes.Zeros): void {
		let zeros: ZeroTypes.Zeros = []
		let names: string[] = []
		let namesMap: {[key: string]: ZeroTypes.Zero[]} = {}

		for (let zeroData of zerosData || []) {
			let zero = ZeroTypes.New(zeroData)
			let name = zero.formattedName()

			let zerosName: ZeroTypes.Zero[] = namesMap[name]
			if (!zerosName) {
				zerosName = []
			}
			zerosName.push(zero)

			names.push(name)
			namesMap[name] = zerosName
		}

		names.sort()

		this._map = {}
		let count = 0

		for (let name of names) {
			for (let zero of namesMap[name]) {
				if (this._map[zero.id] !== undefined) {
					continue
				}
				this._map[zero.id] = count
				zeros.push(zero)
				count += 1
			}
		}

		this._zeros = zeros
	}

	_callback(action: ZeroTypes.ZeroDispatch): void {
		switch (action.type) {
			case GlobalTypes.RESET:
				this._reset();
				break;

			case ZeroTypes.SYNC:
				this._sync(action.data.zeros);
				this.emitChange();
				break;
		}
	}
}

export default new ZerosStore();
