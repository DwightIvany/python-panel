import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import PythonPanel from "./main";
import { isSeparator, parseSeparator } from "./separator";
import * as child_process from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";

const exec = promisify(child_process.exec);

/** Scripts that reflow/replace the active editor selection (no Ctrl+C/V). */
const SELECTION_SCRIPT_NAMES = new Set([
	"reflow_prose_selection.py",
	"reflow-prose-selection.py",
]);

/** Default Node exec timeout is too short for Selenium inbox walks. */
function scriptTimeoutMs(scriptPath: string): number {
	const name = scriptPath.replace(/\\/g, "/").split("/").pop() ?? "";
	if (/^outlook_(export|unread_list|mark_unread)/i.test(name)) {
		return 45 * 60 * 1000;
	}
	return 60_000;
}

/** Last "Done. ..." summary line from script stdout, if any (e.g. "Done. exported=59 failures=0"). */
function doneSummaryLine(stdout: string | undefined): string | null {
	if (!stdout) return null;
	const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].startsWith("Done.")) {
			return lines[i].replace(/^Done\.\s*/, "");
		}
	}
	return null;
}

export const VIEW_TYPE = "python-panel-view";

export class CustomWeeklyView extends ItemView {
	plugin: PythonPanel;
	containerEl: HTMLElement;
	runningScripts: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf, plugin: PythonPanel) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getDisplayText() {
		return "Python Panel";
	}

	getIcon() {
		return "calendar-clock";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("python-panel-container");

		// Create header
		const header = container.createEl("h2", { text: "Python Panel" });
		header.style.marginTop = "0";

		// Create buttons for each script
		const buttonContainer = container.createDiv();
		for (const scriptPath of this.plugin.settings.scripts) {
			if (isSeparator(scriptPath)) {
				this.createSeparator(buttonContainer, scriptPath);
			} else {
				this.createScriptButton(buttonContainer, scriptPath);
			}
		}

		// Create status area
		this.statusEl = container.createDiv("python-panel-status");
		this.statusEl.style.display = "none";
	}

	createScriptButton(container: HTMLElement, scriptPath: string) {
		const button = container.createEl("button", {
			cls: "python-panel-button",
			text: this.getScriptName(scriptPath)
		});

		button.addEventListener("click", () => {
			this.runScript(scriptPath, button);
		});
	}

	createSeparator(container: HTMLElement, entry: string) {
		const { label } = parseSeparator(entry);
		if (label) {
			container.createEl("h4", {
				cls: "python-panel-separator-label",
				text: label
			});
		} else {
			container.createEl("hr", { cls: "python-panel-separator" });
		}
	}

	getScriptName(scriptPath: string): string {
		const parts = scriptPath.split(/[/\\]/);
		return parts[parts.length - 1];
	}

	isSelectionScript(scriptPath: string): boolean {
		return SELECTION_SCRIPT_NAMES.has(this.getScriptName(scriptPath));
	}

	async runSelectionScript(
		scriptPath: string,
		fullScriptPath: string,
		pythonCmd: string,
		vaultPath: string,
		activeFilePath: string | null
	): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			throw new Error("Open a markdown note first.");
		}

		const editor = view.editor;
		const selected = editor.getSelection();
		if (!selected.trim()) {
			throw new Error("Select text in the note, then click the button.");
		}

		const pluginDir = path.join(vaultPath, ".obsidian", "plugins", "python-panel");
		await fs.mkdir(pluginDir, { recursive: true });
		const selectionIn = path.join(pluginDir, "selection-in.txt");
		const selectionOut = path.join(pluginDir, "selection-out.txt");
		await fs.writeFile(selectionIn, selected, "utf8");

		const env = {
			...process.env,
			PYTHONIOENCODING: "utf-8",
			OBSIDIAN_SELECTION_IN: selectionIn,
			OBSIDIAN_SELECTION_OUT: selectionOut,
			...(activeFilePath && { OBSIDIAN_ACTIVE_FILE: activeFilePath }),
		};

		const { stdout, stderr } = await exec(`"${pythonCmd}" "${fullScriptPath}"`, {
			cwd: vaultPath,
			timeout: scriptTimeoutMs(scriptPath),
			maxBuffer: 10 * 1024 * 1024,
			encoding: "utf8",
			env,
		});

		if (stderr?.trim()) {
			console.warn(`[Python Panel] ${this.getScriptName(scriptPath)} warnings:`, stderr);
		}

		let result = "";
		try {
			result = await fs.readFile(selectionOut, "utf8");
		} catch {
			// output file missing — fall back to stdout
		}
		if (!result.trim()) {
			result = stdout ?? "";
		}

		if (!result.trim()) {
			throw new Error(
				"Reflow produced no output (selection was not changed). " +
					"Check the console or run the script from a terminal."
			);
		}

		editor.replaceSelection(result);
	}

	async runScript(scriptPath: string, button: HTMLElement) {
		if (this.runningScripts.has(scriptPath)) {
			return;
		}

		this.runningScripts.add(scriptPath);
		button.addClass("running");
		button.setAttribute("disabled", "true");
		this.hideStatus();

		try {
			const pythonCmd = await this.findPython();
			// Use type assertion to access basePath which exists at runtime
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const fullScriptPath = `${vaultPath}/${scriptPath}`.replace(/\\/g, "/");

			// Get active file path if available (scripts can use this if needed)
			const activeFile = this.app.workspace.getActiveFile();
			const activeFilePath = activeFile 
				? `${vaultPath}/${activeFile.path}`.replace(/\\/g, "/")
				: null;

			if (this.isSelectionScript(scriptPath)) {
				await this.runSelectionScript(
					scriptPath,
					fullScriptPath,
					pythonCmd,
					vaultPath,
					activeFilePath
				);
			} else {
				const env = {
					...process.env,
					PYTHONIOENCODING: "utf-8",
					...(activeFilePath && { OBSIDIAN_ACTIVE_FILE: activeFilePath }),
				};

				const { stdout, stderr } = await exec(`"${pythonCmd}" "${fullScriptPath}"`, {
					cwd: vaultPath,
					timeout: scriptTimeoutMs(scriptPath),
					maxBuffer: 10 * 1024 * 1024,
					encoding: "utf8",
					env,
				});

				if (stdout) {
					console.log(
						`[Python Panel] ${this.getScriptName(scriptPath)} output:`,
						stdout
					);
				}
				if (stderr) {
					console.warn(
						`[Python Panel] ${this.getScriptName(scriptPath)} warnings:`,
						stderr
					);
				}

				const done = doneSummaryLine(stdout);
				new Notice(
					done
						? `${this.getScriptName(scriptPath)} — ${done}`
						: `Script completed: ${this.getScriptName(scriptPath)}`,
					15_000
				);
			}

			this.showStatus("success", `Script completed: ${this.getScriptName(scriptPath)}`);
			
		} catch (error: any) {
			// exec rejects on non-zero exit but still carries the script's output;
			// log it like the success path so partial results aren't lost.
			if (error.stdout) {
				console.log(
					`[Python Panel] ${this.getScriptName(scriptPath)} output:`,
					error.stdout
				);
			}
			if (error.stderr) {
				console.warn(
					`[Python Panel] ${this.getScriptName(scriptPath)} warnings:`,
					error.stderr
				);
			}

			let errorMsg = "Script failed";
			if (error.message && typeof error.message === "string" && !error.stderr) {
				errorMsg = error.message;
			} else if (error.code === "ENOENT") {
				errorMsg = "Python not found. Please install Python.";
			} else if (error.code === "ETIMEDOUT") {
				errorMsg = "Script timed out";
			} else if (error.stderr) {
				// Try to extract a simple error message
				const stderrLines = error.stderr.split("\n").filter((line: string) => line.trim());
				if (stderrLines.length > 0) {
					const lastLine = stderrLines[stderrLines.length - 1];
					if (lastLine.includes("Error") || lastLine.includes("error")) {
						errorMsg = lastLine.substring(0, 100); // Limit length
					}
				}
			}
			
			const done = doneSummaryLine(error.stdout);
			const exit = error.code != null ? ` (exit ${error.code})` : "";
			new Notice(
				`${this.getScriptName(scriptPath)} failed${exit}` +
					(done ? ` — ${done}` : "") +
					" — see console for details",
				20_000
			);

			this.showStatus("error", `${this.getScriptName(scriptPath)}: ${errorMsg}`);
			console.error(`[Python Panel] Error running ${scriptPath}:`, error);
		} finally {
			this.runningScripts.delete(scriptPath);
			button.removeClass("running");
			button.removeAttribute("disabled");
		}
	}

	async findPython(): Promise<string> {
		// Try common Python commands
		const commands = ["python3", "python", "py"];
		
		for (const cmd of commands) {
			try {
				await exec(`"${cmd}" --version`, {
					env: { ...process.env, PYTHONIOENCODING: "utf-8" }
				});
				return cmd;
			} catch {
				// Try next command
			}
		}
		
		throw new Error("Python not found. Please install Python.");
	}

	showStatus(type: "success" | "error", message: string) {
		this.statusEl.textContent = message;
		this.statusEl.className = `python-panel-status ${type}`;
		this.statusEl.style.display = "block";
		
		// Auto-hide after 5 seconds
		setTimeout(() => {
			this.hideStatus();
		}, 5000);
	}

	hideStatus() {
		this.statusEl.style.display = "none";
	}

	statusEl: HTMLElement;
}
