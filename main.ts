import { Plugin } from "obsidian";
import { PythonPanelView, VIEW_TYPE } from "./view";
import { PythonPanelSettingTab } from "./settings";

interface PythonPanelSettings {
	scripts: string[];
}

const DEFAULT_SETTINGS: PythonPanelSettings = {
	scripts: [
		"software/python/obsidian-scripts/copy-focus-to-weekly.py",
		"software/python/obsidian-scripts/99clean.py",
		"software/python/obsidian-scripts/remove-empty-sections.py",
		"software/python/obsidian-scripts/remove-due-block.py",
		"software/python/obsidian-scripts/cleanup-latest-weekly.py"
	]
};

export default class PythonPanelPlugin extends Plugin {
	settings: PythonPanelSettings;

	async onload() {
		await this.loadSettings();

		// Register the view
		this.registerView(
			VIEW_TYPE,
			(leaf) => new PythonPanelView(leaf, this)
		);

		// Add ribbon icon to open the view
		this.addRibbonIcon("calendar-clock", "Python Panel", () => {
			void this.activateView();
		});

		// Add command to open the view (sidebar with script buttons)
		this.addCommand({
			id: "open-panel",
			name: "Open sidebar",
			callback: () => {
				void this.activateView();
			}
		});

		// Add command to open the latest weekly note file
		this.addCommand({
			id: "open-latest-weekly-note",
			name: "Open latest weekly note",
			callback: () => {
				void this.openLatestWeeklyNote();
			}
		});

		// Add settings tab
		this.addSettingTab(new PythonPanelSettingTab(this.app, this));

		// Open sidebar when workspace is ready (avoid getRightLeaf null on startup)
		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);

		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (!rightLeaf) {
			return;
		}
		await rightLeaf.setViewState({
			type: VIEW_TYPE,
			active: true,
		});
	}

	/** Refresh the panel view if it's open (e.g. after a settings change). */
	refreshView() {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (leaf && leaf.view instanceof PythonPanelView) {
			void leaf.view.refresh();
		}
	}

	/** Find and open the most recent weekly note (daily/.../YYYY-MM-DD-week-NN.md). */
	async openLatestWeeklyNote() {
		// Weekly notes: daily/YYYY-MM-DD-week-NN.md or daily/years+/...
		const dateInPath = /(\d{4}-\d{2}-\d{2})-week-\d+\.md$/;
		const files = this.app.vault.getMarkdownFiles()
			.filter((f) => f.path.startsWith("daily/") && dateInPath.test(f.path))
			.map((f) => {
				const m = f.path.match(dateInPath);
				return { file: f, dateStr: m ? m[1] : "0000-00-00" };
			})
			.sort((a, b) => (a.dateStr > b.dateStr ? -1 : 1));

		if (files.length === 0) {
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(files[0].file);
	}

	async loadSettings() {
		const data = await this.loadData() as Partial<PythonPanelSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
