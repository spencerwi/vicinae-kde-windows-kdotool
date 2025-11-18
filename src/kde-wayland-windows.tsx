import { useState, useMemo, useEffect } from "react";
import { Action, ActionPanel, Icon, List, closeMainWindow } from "@vicinae/api";
const { spawnSync } = require('child_process');
import freedesktopIcons from 'freedesktop-icons';

type KDoToolError = {
	type: 'error'
	statusCode : number | null
	stderr : string
}
type KDoToolSuccess<T> = {
	type: 'success'
	value : T
}

type KDoToolResult<T> = KDoToolError | KDoToolSuccess<T>;

class Results {
	static mapResult<I,O>(result: KDoToolResult<I>, fn : (iVal : I) => O) : KDoToolResult<O> {
		if (result.type === 'error') {
			return result as KDoToolResult<O>;
		}
		return {
			type: 'success',
			value: fn(result.value)
		}
	}

	static flatMapResult<I,O>(result: KDoToolResult<I>, fn : (iVal : I) => KDoToolResult<O>) : KDoToolResult<O> {
		if (result.type === 'error') {
			return result as KDoToolResult<O>;
		}
		return fn(result.value);
	}

	static getOrDefault<T>(result : KDoToolResult<T>, fallback: T) : T {
		if (result.type === 'error') {
			return fallback;
		}
		return result.value;
	}
}



type KdeWindowId = string;

type KdeWindow = {
	id: string
	name: string
	className: string
	iconUrl: string
}

async function findIcon(windowClassName : string) : Promise<string> {
	return freedesktopIcons(windowClassName);
}

class KDoTool {
	static runCommand(args : string[]) : KDoToolResult<string> {
		const result = spawnSync('kdotool', args);
		if (result.status != 0) {
			return {
				type: 'error',
				statusCode: result.status,
				stderr: result.stderr.toString().trim()
			};
		}
		return {
			type: 'success',
			value: result.stdout.toString().trim()
		};
	}

	static searchWindowIds(query : string) : KDoToolResult<KdeWindowId[]> {
		const searchCmdResult = spawnSync('kdotool', ['search', query]);
		if (searchCmdResult.status != 0) {
			return {
				type: 'error',
				statusCode: searchCmdResult.status,
				stderr: searchCmdResult.stderr.toString()
			};
		}

		const windowIds : KdeWindowId[] = searchCmdResult.stdout.toString()
			.split('\n')
			.filter((line : string) => line.trim().length > 0)
			.map((line : string)  => line.trim())

		return {
			type: 'success',
			value: windowIds
		}
	}

	static async fetchWindows(windowIds : KdeWindowId[]) : Promise<KdeWindow[]> {
		return Promise.all(
			windowIds.map(async (windowId) => {
				let windowNameResult = KDoTool.runCommand(['getwindowname', windowId]);
				if (windowNameResult.type === 'error') {
					console.error(`Error fetching window with id '${windowId}: ${windowNameResult.stderr}`);
					return [];
				}
				let windowName = windowNameResult.value;
				if (!windowName) {
					return [];
				}
				let windowClassName = Results.getOrDefault(
					KDoTool.runCommand(['getwindowclassname', windowId]),
					''
				);
				let iconUrl;
				if (windowClassName) {
					iconUrl = await findIcon(windowClassName);
				} 
				if (!iconUrl) {
					iconUrl = `xdg:${windowClassName}`;
				}
				let window = {
					id: windowId,
					name: windowName,
					className: windowClassName,
					iconUrl
				};
				console.table(window);
				return [window];
			})
		).then(arr => arr.flat());
	}

	static activateWindow(windowId : KdeWindowId) : void {
		KDoTool.runCommand(['windowactivate', windowId]);
	}
}


export default function KdeWindowList() {
	// search is explicitly controlled by state
	const [searchText, setSearchText] = useState("");
	const [results, setResults] = useState<KdeWindow[]>([]);

	 useEffect(() => {
		async function search() {
			let windowIdsMaybe = KDoTool.searchWindowIds(searchText);
			if (windowIdsMaybe.type === 'error') {
				console.error(windowIdsMaybe.stderr);
				setResults([]);
				return;
			}
			let windowResults = await KDoTool.fetchWindows(windowIdsMaybe.value);
			setResults(windowResults);
		};
		search();
	}, [searchText]);

	return (
		<List
			searchText={searchText}
			onSearchTextChange={setSearchText}
			searchBarPlaceholder={"Search open windows..."}
		>
			<List.Section title={"Windows"}>
				{results.map((window) => (
					<List.Item
						key={window.id}
						title={window.name}
						icon={window.iconUrl}
						keywords={[window.name, window.className]}
						actions={
							<ActionPanel>
								<Action
									title="Activate"
									icon={Icon.ArrowUp}
									onAction={async () => {
										KDoTool.activateWindow(window.id);
										await closeMainWindow({ clearRootSearch: true });
									}}
								/>
							</ActionPanel>
						}
					/>
				))}
			</List.Section>
		</List>
	);
}
