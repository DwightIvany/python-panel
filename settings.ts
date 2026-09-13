import { Plugin, PluginSettingTab, Setting, App } from "obsidian";
import CustomWeeklyPlugin from "./main";
import { isSeparator } from "./separator";

export class CustomWeeklySettingTab extends PluginSettingTab {
	plugin: CustomWeeklyPlugin;

	constructor(app: App, plugin: CustomWeeklyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Python Panel Settings").setHeading();

		containerEl.createEl("p", {
			text: "Configure Python scripts to run from the sidebar. Scripts should be relative to your vault root."
		});

		// Scripts list
		new Setting(containerEl).setName("Scripts").setHeading();

		const scriptsContainer = containerEl.createDiv();

		const moveScript = async (fromIndex: number, toIndex: number) => {
			if (toIndex < 0 || toIndex >= this.plugin.settings.scripts.length) return;
			const scripts = this.plugin.settings.scripts;
			[scripts[fromIndex], scripts[toIndex]] = [scripts[toIndex], scripts[fromIndex]];
			await this.plugin.saveSettings();
			this.display();
			if (this.plugin.view) {
				this.plugin.view.onOpen();
			}
		};

		this.plugin.settings.scripts.forEach((script, index) => {
			if (isSeparator(script)) {
				new Setting(scriptsContainer)
					.setName("Separator")
					.setClass("python-panel-entry-setting python-panel-separator-setting")
					.addText((text) => {
						text
							.setPlaceholder("--- or --- Group name")
							.setValue(script)
							.onChange(async (value) => {
								this.plugin.settings.scripts[index] = value;
								await this.plugin.saveSettings();
								// Refresh the view if it's open
								if (this.plugin.view) {
									this.plugin.view.onOpen();
								}
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("arrow-up")
							.setTooltip("Move separator up")
							.setDisabled(index === 0)
							.onClick(async () => {
								await moveScript(index, index - 1);
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("arrow-down")
							.setTooltip("Move separator down")
							.setDisabled(index === this.plugin.settings.scripts.length - 1)
							.onClick(async () => {
								await moveScript(index, index + 1);
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("trash")
							.setTooltip("Remove separator")
							.onClick(async () => {
								this.plugin.settings.scripts.splice(index, 1);
								await this.plugin.saveSettings();
								this.display(); // Refresh settings
								// Refresh the view if it's open
								if (this.plugin.view) {
									this.plugin.view.onOpen();
								}
							});
					});
			} else {
				new Setting(scriptsContainer)
					.setClass("python-panel-entry-setting")
					.addText((text) => {
						text
							.setPlaceholder("path/to/script.py")
							.setValue(script)
							.onChange(async (value) => {
								this.plugin.settings.scripts[index] = value;
								await this.plugin.saveSettings();
								// Refresh the view if it's open
								if (this.plugin.view) {
									this.plugin.view.onOpen();
								}
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("arrow-up")
							.setTooltip("Move script up")
							.setDisabled(index === 0)
							.onClick(async () => {
								await moveScript(index, index - 1);
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("arrow-down")
							.setTooltip("Move script down")
							.setDisabled(index === this.plugin.settings.scripts.length - 1)
							.onClick(async () => {
								await moveScript(index, index + 1);
							});
					})
					.addExtraButton((button) => {
						button
							.setIcon("trash")
							.setTooltip("Remove script")
							.onClick(async () => {
								this.plugin.settings.scripts.splice(index, 1);
								await this.plugin.saveSettings();
								this.display(); // Refresh settings
								// Refresh the view if it's open
								if (this.plugin.view) {
									this.plugin.view.onOpen();
								}
							});
					});
			}
		});

		// Add new script button
		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add Script")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.scripts.push("");
						await this.plugin.saveSettings();
						this.display(); // Refresh settings
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Add Separator")
					.onClick(async () => {
						this.plugin.settings.scripts.push("---");
						await this.plugin.saveSettings();
						this.display(); // Refresh settings
					});
			});
	}
}
