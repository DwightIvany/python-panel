import { Plugin, TFile } from "obsidian";
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

/** ISO-8601 week number (weeks start Monday; week 1 contains Jan 4th). */
function isoWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7; // Monday = 1 ... Sunday = 7
	d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of this week
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

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

	/**
	 * Find and open the most recent weekly note (daily/YYYY-MM-DD-week-NN.md).
	 *
	 * Walks backwards day by day probing exact paths, so no vault-wide
	 * enumeration is needed. Assumes filenames follow the ISO week
	 * convention (the week number matches the ISO week of the embedded date).
	 */
	async openLatestWeeklyNote() {
		const MAX_DAYS_BACK = 10 * 366;
		const today = new Date();
		for (let i = 0; i < MAX_DAYS_BACK; i++) {
			const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
			const iso = d.toLocaleDateString("en-CA"); // YYYY-MM-DD (local time)
			const week = String(isoWeekNumber(d)).padStart(2, "0");
			const file = this.app.vault.getAbstractFileByPath(`daily/${iso}-week-${week}.md`);
			if (file instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(file);
				return;
			}
		}
	}

	async loadSettings() {
		const data = await this.loadData() as Partial<PythonPanelSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
