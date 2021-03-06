import { createStore, Store, Action } from 'redux'
import { reduce } from './reducers'
import { createDragDropActions } from './actions/dragDrop'
import { DragDropMonitorImpl } from './DragDropMonitorImpl'
import { HandlerRegistryImpl } from './HandlerRegistryImpl'
import {
	ActionCreator,
	Backend,
	DragDropActions,
	DragDropMonitor,
	DragDropManager,
	HandlerRegistry,
} from './interfaces'
import { State } from './reducers'

function makeStoreInstance(debugMode: boolean): Store<State> {
	// TODO: if we ever make a react-native version of this,
	// we'll need to consider how to pull off dev-tooling
	const reduxDevTools =
		typeof window !== 'undefined' &&
		(window as any).__REDUX_DEVTOOLS_EXTENSION__
	return createStore(
		reduce,
		debugMode &&
			reduxDevTools &&
			reduxDevTools({
				name: 'dnd-core',
				instanceId: 'dnd-core',
			}),
	)
}

export class DragDropManagerImpl implements DragDropManager {
	private store: Store<State>
	private monitor: DragDropMonitor
	private backend: Backend | undefined
	private isSetUp = false

	public constructor(debugMode = false) {
		const store = makeStoreInstance(debugMode)
		this.store = store
		this.monitor = new DragDropMonitorImpl(
			store,
			new HandlerRegistryImpl(store),
		)
		store.subscribe(this.handleRefCountChange)
	}

	public receiveBackend(backend: Backend): void {
		this.backend = backend
	}

	public getMonitor(): DragDropMonitor {
		return this.monitor
	}

	public getBackend(): Backend {
		return this.backend as Backend
	}

	public getRegistry(): HandlerRegistry {
		return (this.monitor as DragDropMonitorImpl).registry
	}

	public getActions(): DragDropActions {
		/* eslint-disable-next-line @typescript-eslint/no-this-alias */
		const manager = this
		const { dispatch } = this.store

		function bindActionCreator(actionCreator: ActionCreator<any>) {
			return (...args: any[]) => {
				const action = actionCreator.apply(manager, args as any)
				if (typeof action !== 'undefined') {
					dispatch(action)
				}
			}
		}

		const actions = createDragDropActions(this)

		return Object.keys(actions).reduce(
			(boundActions: DragDropActions, key: string) => {
				const action: ActionCreator<any> = (actions as any)[
					key
				] as ActionCreator<any>
				;(boundActions as any)[key] = bindActionCreator(action)
				return boundActions
			},
			{} as DragDropActions,
		)
	}

	public dispatch(action: Action<any>): void {
		this.store.dispatch(action)
	}

	private handleRefCountChange = (): void => {
		const shouldSetUp = this.store.getState().refCount > 0
		if (this.backend) {
			if (shouldSetUp && !this.isSetUp) {
				this.backend.setup()
				this.isSetUp = true
			} else if (!shouldSetUp && this.isSetUp) {
				this.backend.teardown()
				this.isSetUp = false
			}
		}
	}
}
