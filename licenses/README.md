# License Files Directory

This directory contains the full text of various open-source licenses used in this project.

## Required License Files

Place the following license files in this directory:

- **MIT.txt** - MIT License
  - Download from: https://raw.githubusercontent.com/spdx/license-list-data/main/text/MIT.txt
  - Or from: https://opensource.org/licenses/MIT

- **GPL-3.0.txt** - GNU General Public License v3.0
  - Download from: https://www.gnu.org/licenses/gpl-3.0.txt
  - Or from: https://www.gnu.org/licenses/gpl-3.0.html

- **LGPL-3.0.txt** - GNU Lesser General Public License v3.0
  - Download from: https://www.gnu.org/licenses/lgpl-3.0.txt
  - Or from: https://www.gnu.org/licenses/lgpl-3.0.html

- **APACHE-2.0.txt** - Apache License 2.0
  - Download from: https://www.apache.org/licenses/LICENSE-2.0.txt
  - Or from: https://apache.org/licenses/LICENSE-2.0

- **CC0-1.0.txt** - Creative Commons Zero v1.0 Universal
  - Download from: https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt
  - Or from: https://creativecommons.org/publicdomain/zero/1.0/legalcode

- **MPL-2.0.txt** - Mozilla Public License 2.0
  - Download from: https://www.mozilla.org/media/MPL/2.0/index.815ca599c9df.txt
  - Or from: https://mozilla.org/MPL/2.0/

- **ISC.txt** - ISC License
  - Download from: https://opensource.org/licenses/ISC
  - Or from: https://choosealicense.com/licenses/isc/

- **unlicense.txt** - The Unlicense
  - Download from: https://raw.githubusercontent.com/spdx/license-list-data/main/text/Unlicense.txt
  - Or from: https://unlicense.org/

- **MarkedJS.txt** - MarkedJS and bundled Markdown attribution notice
  - Source from bundled project notice: external_js/marked.js
  - Or maintain as a local project notice file in licenses/MarkedJS.txt

## How to Use

1. Download each license file from the official sources listed above
2. Save them with the exact filenames shown (.txt extension)
3. Place them in this licenses/ directory
4. Run the build command to generate copyright documentation

## Note

Most license files are NOT distributed with the build tool. You must download them
yourself from the official sources to ensure you have the most current and accurate
license text. MarkedJS.txt is a project-specific notice file and should be kept
in sync with the bundled external_js/marked.js notice block.

The build script will read these files and embed them into your project's copyright
documentation when you run the build process.
