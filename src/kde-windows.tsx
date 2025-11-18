import { useState, useMemo } from "react";
import { Action, ActionPanel, Icon, List } from "@vicinae/api";
const { spawnSync } = require('child_process');

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

function findIconFromDesktopFile(windowClassName : string) : string {
	return ''; // TODO: this, once I see everything else working
}

class KDoTool {
	static runCommand(args : string[]) : KDoToolResult<string> {
		const result = spawnSync('kdotool', args);
		if (result.status != 0) {
			return {
				type: 'error',
				statusCode: result.status,
				stderr: result.stderr.toString()
			};
		}
		return {
			type: 'success',
			value: result.stdout.toString()
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

	static fetchWindows(windowIds : KdeWindowId[]) : KdeWindow[] {
		return windowIds.flatMap(windowId => {
			let windowNameResult = KDoTool.runCommand(['getwindowname', windowId]);
			if (windowNameResult.type === 'error') {
				console.error(`Error fetching window with id '${windowId}: ${windowNameResult.stderr}`);
				return [];
			}
			let windowName = windowNameResult.value;
			let windowClassName = Results.getOrDefault(
				KDoTool.runCommand(['getwindowclassname', windowId]),
				''
			);
			let iconUrl;
			if (windowClassName) {
				iconUrl = findIconFromDesktopFile(windowClassName);
			} 
			if (!iconUrl) {
				iconUrl = `xdg:${windowClassName}`;
			}
			return [{
				id: windowId,
				name: windowName,
				className: windowClassName,
				iconUrl
			}];
		})
	}

	static activateWindow(windowId : KdeWindowId) : void {
		KDoTool.runCommand(['windowactivate', windowId]);
	}
}



export default function KdeWindowList() {
	// search is explicitly controlled by state
	const [searchText, setSearchText] = useState("");

	const searchWindows = (query: string) => {
		return Results.getOrDefault(
			Results.mapResult(
				KDoTool.searchWindowIds(query),
				KDoTool.fetchWindows
			),
			[]
		);
	};

	const filteredWindows = useMemo(() => searchWindows(searchText), [searchText]);

	return (
		<List
			searchText={searchText}
			onSearchTextChange={setSearchText}
			searchBarPlaceholder={"Search open windows..."}
		>
			<List.Section title={"Windows"}>
				{filteredWindows.map((window) => (
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
									onAction={() =>
										KDoTool.activateWindow(window.id)
									}
								/>
							</ActionPanel>
						}
					/>
				))}
			</List.Section>
		</List>
	);
}
