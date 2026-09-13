import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import PythonPanelPlugin from "./main";
import { isSeparator } from "./separator";

export class PythonPanelSettingTab extends PluginSettingTab {
	plugin: PythonPanelPlugin;

	constructor(app: App, plugin: PythonPanelPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		const match = /^scripts\.(\d+)$/.exec(key);
		if (match) {
			return this.plugin.settings.scripts[Number(match[1])] ?? "";
		}
		return super.getControlValue(key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const match = /^scripts\.(\d+)$/.exec(key);
		if (match && typeof value === "string") {
			this.plugin.settings.scripts[Number(match[1])] = value;
			await this.plugin.saveSettings();
			this.plugin.refreshView();
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const scripts = this.plugin.settings.scripts;
		return [
			{
				type: "list" as const,
				heading: "Scripts",
				emptyState: "No scripts configured.",
				addItem: {
					name: "Add script",
					action: () => {
						void this.addScript();
					},
				},
				onReorder: (oldIndex: number, newIndex: number) => {
					const [moved] = scripts.splice(oldIndex, 1);
					scripts.splice(newIndex, 0, moved);
					void this.persistAndRefresh();
				},
				onDelete: (index: number) => {
					scripts.splice(index, 1);
					void this.persistAndRefresh().then(() => this.update());
				},
				items: scripts.map((entry, index) => ({
					name: isSeparator(entry) ? "Separator" : "Script",
					searchable: false,
					control: {
						type: "text" as const,
						key: `scripts.${index}`,
						placeholder: isSeparator(entry)
							? "--- or --- Group name"
							: "path/to/script.py",
					},
				})),
			},
		];
	}

	private async persistAndRefresh(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.refreshView();
	}

	private async addScript(): Promise<void> {
		this.plugin.settings.scripts.push("");
		await this.plugin.saveSettings();
		this.update();
	}
}
