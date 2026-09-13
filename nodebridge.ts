/**
 * Node built-in bridging for this desktop-only plugin.
 *
 * The plugin review's type program does not include @types/node, so the
 * built-in imports below are any-typed there. This wrapper keeps that
 * any-ness in one place and exposes fully typed helpers to the rest of
 * the plugin; the eslint-disable comments target that lint run.
 */
import { exec as nodeExec } from "child_process";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
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

/** Join path segments with the platform separator. */
export function joinPath(...parts: string[]): string {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const result: string = join(...parts);
	return result;
}

/** Create a directory and any missing parents. */
export function mkdirp(dir: string): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const created: Promise<unknown> = mkdir(dir, { recursive: true });
	return created.then(() => undefined);
}

/** Read a utf-8 text file. */
export function readTextFile(path: string): Promise<string> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const result: Promise<string> = readFile(path, "utf8");
	return result;
}

/** Write a utf-8 text file. */
export function writeTextFile(path: string, data: string): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const result: Promise<void> = writeFile(path, data, "utf8");
	return result;
}
