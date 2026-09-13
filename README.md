# Python Panel Plugin

An Obsidian plugin that provides a sidebar with buttons to run Python scripts.

## Setup

1. Build (no npm required on Windows):
   ```
   .\build.ps1
   ```
   Writes `.obsidian/plugins/python-panel/main.js`. First run downloads
   `tools/esbuild.exe` (~10 MB).

   If you have Node/npm on PATH: `npm install` then `npm run build`.

2. Or for development with watch mode:
   ```
   npm run dev
   ```

3. Enable the plugin in Obsidian:
   - Go to Settings â†’ Community plugins
   - Find "Python Panel" and enable it
   - The sidebar should open automatically

## Features

- **Sidebar View**: Opens automatically with buttons for each configured script
- **Script Buttons**: Click any button to run the corresponding Python script
- **Status Feedback**: Shows success/error messages after script execution
- **Settings**: Configure which scripts appear in the sidebar, reorder them, and add separators
- **Auto Python Detection**: Automatically finds Python (tries python3, python, py)

## Default Scripts

The plugin comes pre-configured with these 5 scripts:
- copy-focus-to-weekly.py
- 99clean.py
- remove-empty-sections.py
- remove-due-block.py
- cleanup-latest-weekly.py

## Configuration

Go to Settings â†’ Python Panel to:
- Add new scripts (paths relative to vault root)
- Remove scripts
- Edit script paths
- Reorder scripts and separators with the up/down arrow buttons
- Add separators to group scripts

### Separators

Use separators to visually group scripts in the sidebar.

- Click **Add Separator** in settings to insert a divider.
- To create a labeled group heading, edit the separator text from `---` to `--- Group Name`.
- Use the up/down arrow buttons to reorder separators and scripts.
- Plain `---` entries render as a horizontal line.
- Separator entries are stored right in the `scripts` list, so you can also edit `data.json` directly:
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

1. Open the Python Panel sidebar (click the calendar-clock icon in the ribbon, or use the command)
2. Click any script button to run it
3. Wait for the script to complete (button shows running state)
4. Check the status message for success/error feedback

### Selection scripts (e.g. `reflow_prose_selection.py`)

For reflow and similar tools, **select text in the open note first**, then click the button.
The plugin passes the selection to Python and replaces it in the editor (no clipboard shortcuts).

After changing `view.ts`, rebuild: `npm run build` in this folder, then reload Obsidian.

## Requirements

- Python 3.x installed and available in PATH
- Scripts must be relative to your vault root
