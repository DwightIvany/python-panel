# Python Panel

An [Obsidian](https://obsidian.md) plugin that adds a sidebar panel of buttons for running Python scripts located in your vault.

## Features

- **Sidebar panel** — opens automatically on startup, with one button per configured script
- **Script buttons** — click a button to run the corresponding Python script; the button shows a running state while the script executes
- **Status feedback** — success/error notices after each run, including a `Done. ...` summary line if the script prints one
- **Separators and group labels** — organize buttons with horizontal rules or `--- Group Name` headings
- **Auto Python detection** — finds Python automatically (tries `python3`, `python`, then `py`)
- **Selection scripts** — scripts named `reflow_prose_selection.py` (or `reflow-prose-selection.py`) receive the current editor selection and replace it with the script output
- **Commands** — *Open Python Panel (sidebar)* and *Open latest weekly note*
- **Settings tab** — add, edit, reorder, and remove scripts and separators

## Requirements

- Obsidian 0.15.0 or later
- Python 3.x installed and available on `PATH`

## Installation

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/DwightIvany/python-panel/releases/latest) and copy them into your vault's plugin folder:

```
<your vault>/.obsidian/plugins/python-panel/
```

Create the `python-panel` folder if it doesn't exist. Then enable the plugin:

1. Go to **Settings → Community plugins**
2. Find **Python Panel** and enable it
3. The sidebar opens automatically; reopen it any time with the calendar-clock ribbon icon or the *Open Python Panel* command

## Configuration

Go to **Settings → Python Panel** to add, edit, reorder, and remove scripts. Script paths are relative to your vault root.

### Separators

Use separators to visually group scripts in the sidebar:

- Click **Add Separator** in settings to insert a divider
- Plain `---` renders as a horizontal line
- Edit the text to `--- Group Name` to render a labeled group heading
- Use the up/down arrow buttons to reorder separators alongside scripts

Separator entries are stored right in the `scripts` list, so you can also edit `data.json` directly:

```json
"scripts": [
  "software/python/obsidian-scripts/script-a.py",
  "--- Review",
  "software/python/obsidian-scripts/script-b.py",
  "---",
  "software/python/obsidian-scripts/script-c.py"
]
```

## Usage

1. Open the Python Panel sidebar (calendar-clock ribbon icon, or the *Open Python Panel* command)
2. Click a script button to run it
3. Wait for the script to complete (the button shows a running state)
4. Check the status message / notice for success or error feedback

Scripts run with the vault root as the working directory. The active note's absolute path is passed to the script in the `OBSIDIAN_ACTIVE_FILE` environment variable.

### Selection scripts

For reflow-style tools (e.g. `reflow_prose_selection.py`), **select text in the open note first**, then click the button. The plugin passes the selection to Python and replaces it in the editor — no clipboard shortcuts involved. The selection is passed via the `OBSIDIAN_SELECTION_IN` / `OBSIDIAN_SELECTION_OUT` file paths in the environment.

## Building from source

With Node.js installed:

```bash
npm install
npm run build        # writes main.js to this folder (repo root)
```

For development with watch mode:

```bash
npm run dev
```

On Windows without Node/npm, use the standalone build script (downloads `tools/esbuild.exe` on first run):

```powershell
.\build.ps1
```

The script builds `main.js` in the repo root and copies `main.js`, `manifest.json`, and `styles.css` into `../../../.obsidian/plugins/python-panel` (relative to this folder), ready to reload in Obsidian.

## License

[Apache License 2.0](LICENSE)
