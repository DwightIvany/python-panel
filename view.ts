import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import PythonPanelPlugin from "./main";
import { isSeparator, parseSeparator } from "./separator";
import { exec as nodeExec } from "child_process";
import type { ExecOptions as NodeExecOptions } from "child_process";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import * as process from "process";

interface ExecResult {
	stdout: string;
	stderr: string;
}

type ExecOptions = Omit<NodeExecOptions, "encoding"> & {
	encoding?: BufferEncoding;
};

/** Typed wrapper around child_process.exec (promisify's overloads resolve to any). */
function exec(command: string, options?: ExecOptions): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		nodeExec(command, options ?? {}, (error, stdout, stderr) => {
			if (error) {
				// Preserve the script's partial output for the error path.
				Object.assign(error, { stdout, stderr });
				reject(error);
			} else {
				resolve({ stdout: String(stdout), stderr: String(stderr) });
			}
		});
	});
}

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

export class PythonPanelView extends ItemView {
	plugin: PythonPanelPlugin;
	containerEl: HTMLElement;
	runningScripts: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf, plugin: PythonPanelPlugin) {
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

	/** Re-render the panel contents (called after settings change). */
	async refresh(): Promise<void> {
		await this.onOpen();
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("python-panel-container");

		// Create header
		container.createEl("h2", { text: "Python Panel" });

		// Create buttons for each script
		const buttonContainer = container.createDiv();
		for (const scriptPath of this.plugin.settings.scripts) {
			if (isSeparator(scriptPath)) {
				this.createSeparator(buttonContainer, scriptPath);
			} else {
				this.createScriptButton(buttonContainer, scriptPath);
			}
		}

		// Create status area (hidden until showStatus; see styles.css)
		this.statusEl = container.createDiv("python-panel-status");
	}

	createScriptButton(container: HTMLElement, scriptPath: string) {
		const button = container.createEl("button", {
			cls: "python-panel-button",
			text: this.getScriptName(scriptPath)
		});

		button.addEventListener("click", () => {
			void this.runScript(scriptPath, button);
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

		const pluginDir = join(this.app.vault.configDir, "plugins", "python-panel");
		await mkdir(pluginDir, { recursive: true });
		const selectionIn = join(pluginDir, "selection-in.txt");
		const selectionOut = join(pluginDir, "selection-out.txt");
		await writeFile(selectionIn, selected, "utf8");

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

		if (stderr.trim()) {
			console.warn(`[Python Panel] ${this.getScriptName(scriptPath)} warnings:`, stderr);
		}

		let result = "";
		try {
			result = await readFile(selectionOut, "utf8");
		} catch {
			// output file missing — fall back to stdout
		}
		if (!result.trim()) {
			result = stdout;
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
			const vaultPath = (this.app.vault.adapter as unknown as { basePath: string }).basePath;
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
			
		} catch (error: unknown) {
			// exec rejects on non-zero exit but still carries the script's output;
			// surface stderr like the success path so partial results aren't lost.
			const ex = error as { stdout?: unknown; stderr?: unknown; code?: unknown };
			const stdout = typeof ex.stdout === "string" ? ex.stdout : "";
			const stderr = typeof ex.stderr === "string" ? ex.stderr : "";

			if (stderr) {
				console.warn(
					`[Python Panel] ${this.getScriptName(scriptPath)} warnings:`,
					stderr
				);
			}

			let errorMsg = "Script failed";
			if (error instanceof Error && !stderr) {
				errorMsg = error.message;
			} else if (ex.code === "ENOENT") {
				errorMsg = "Python not found. Please install Python.";
			} else if (ex.code === "ETIMEDOUT") {
				errorMsg = "Script timed out";
			} else if (stderr) {
				// Try to extract a simple error message
				const stderrLines = stderr.split("\n").filter((line) => line.trim());
				if (stderrLines.length > 0) {
					const lastLine = stderrLines[stderrLines.length - 1];
					if (lastLine.includes("Error") || lastLine.includes("error")) {
						errorMsg = lastLine.substring(0, 100); // Limit length
					}
				}
			}
			
			const done = doneSummaryLine(stdout);
			const exit = ex.code != null ? ` (exit ${String(ex.code)})` : "";
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
		this.statusEl.className = `python-panel-status ${type} visible`;
		
		// Auto-hide after 5 seconds
		window.setTimeout(() => {
			this.hideStatus();
		}, 5000);
	}

	hideStatus() {
		this.statusEl.className = "python-panel-status";
	}

	statusEl: HTMLElement;
}
