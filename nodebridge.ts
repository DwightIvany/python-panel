/**
 * Node built-in bridging for this desktop-only plugin.
 *
 * The plugin review's type program does not include @types/node, so the
 * built-in imports below are any-typed there. This wrapper keeps that
 * any-ness in one place and exposes fully typed helpers to the rest of
 * the plugin; the eslint-disable comments target that lint run.
 *
 * File I/O intentionally goes through the Vault adapter API (see
 * view.ts), so the only Node surface here is process spawning.
 */
import { exec as nodeExec } from "child_process";
import * as process from "process";

export interface ExecResult {
	stdout: string;
	stderr: string;
}

export interface ExecEnv {
	[key: string]: string | undefined;
}

export interface ExecOptions {
	cwd?: string;
	timeout?: number;
	maxBuffer?: number;
	env?: ExecEnv;
}

/**
 * Run a command and capture its output (utf-8).
 * On failure, rejects with an Error carrying the partial `stdout`/`stderr`.
 */
export function exec(command: string, options?: ExecOptions): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const child: unknown = nodeExec(command, options ?? {}, (error: unknown, stdout: unknown, stderr: unknown) => {
			if (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				Object.assign(err, { stdout, stderr });
				reject(err);
			} else {
				resolve({ stdout: String(stdout), stderr: String(stderr) });
			}
		});
		void child;
	});
}

/** The process environment for child processes. */
export function processEnv(): ExecEnv {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
	const env: ExecEnv = { ...process.env };
	return { ...env };
}
