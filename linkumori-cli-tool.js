#!/usr/bin/env bun

/*
 * ============================================================
 * ClearURLs
 * ============================================================
 * Copyright (c) 2017–2020 Kevin Röbert
 * Modified by Subham Mahesh (c) 2026 (modified parts only)
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * Responsible for the build process, including minification,
 * signing, linting, packaging, and generating copyright
 * documentation with embedded licenses.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-02-13   Subham Mahesh   First modification
 * 2026-03-31   Subham Mahesh   updated license documentation generator code (secound modification)
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 *
 * IMPORTANT NOTES
 * ---------------
 * - git clone is required before running "Generate Commit History";
 *   otherwise commit history generation will not work.
 * - Older modifications may not appear in the generated
 *   COMMIT_HISTORY.md.
 * - If a file's inline notice is limited, check for a separate
 *   file-specific notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the inline notice as the final modification record.
 * - If a separate file-specific notice is provided, check the
 *   file's inline notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the separate notice as the final modification record.
 * - Review individual modified source files for earlier notices.
 * - Some files may not contain notices within the file itself or
 *   may not be listed in COMMIT_HISTORY.md; a separate notice
 *   file may be provided instead.
 * - Not all source files have been modified, but review notices
 *   in all source files and any separate notice files (.md or .txt).
 * ============================================================
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Resolve paths relative to this script file, not process.cwd(), so that
// the CLI works correctly regardless of which directory it is invoked from
// (e.g. CI runners that change the working directory before invoking the script).
const SCRIPT_DIR = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

// Terminal colors and formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

// Configuration
const config = {
  sourceDir: '.',
  buildDir: 'web-ext-artifacts',
  oldCountryNobilityDir: 'Old-Country-Nobility',
  buildIgnoreFile: '.build-ignore',
  envFile: '.env',
  licenseTemplateFile: 'Template.md',
  licenseOutputFile: 'License.md',
  licenseOutputDir: './',
  noticeFile: './data/NOTICE.md',
  urlConfigFile: './data/url-config.json',
  regressionSuiteFile: './tests/regression-suite.json'
};

class LinkumoriCLI {
  constructor() {
    this.env = {};
    this.pslPrepared = false;
    this.pslPreparedMode = null;
    this.localPslParser = null;
    this.localPslLoadFailed = false;
    this.loadEnvironment();
    
    // ClearURLs builder configuration
    this.clearurlsConfig = {
      sourceRulesFile: 'data/linkumori-clearurls.json',
      outputBaseName: 'linkumori',
      combinedRulesFile: 'data/linkumori-clearurls.json',
      compressedRulesFile: 'data/linkumori-clearurls-min.json.lz4'
    };

    // PSL updater configuration
    this.pslConfig = {
      listUrl: null,
      projectUrl: null,
      localFile: 'data/public_suffix_list.dat'
    };

    this.loadUrlConfig();

    // License fetcher configuration - now uses local files
    this.licenseConfig = {
      sources: {
        'MIT': 'licenses/MIT.txt',
        'GPL-3.0': 'licenses/GPL-3.0.txt',
        'LGPL-3.0': 'licenses/LGPL-3.0.txt',
        'APACHE-2.0': 'licenses/APACHE-2.0.txt',
        'CC0-1.0': 'licenses/CC0-1.0.txt',
        'MPL-2.0': 'licenses/MPL-2.0.txt',
        'ISC': 'licenses/ISC.txt',
        'UNLICENSE': 'licenses/unlicense.txt',
        'MARKEDJS': 'licenses/MarkedJS.txt'
      },
      cache: {}
    };
  }

  mergeConfig(target, source) {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.mergeConfig(target[key], value);
        return;
      }
      if (value !== undefined && value !== null) {
        target[key] = value;
      }
    });
  }

  loadUrlConfig() {
    let parsed;
    try {
      const content = fs.readFileSync(config.urlConfigFile, 'utf8');
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Unable to load URL config from ${config.urlConfigFile}: ${error.message}`);
    }

    this.mergeConfig(this.clearurlsConfig, parsed.clearurls);
    this.mergeConfig(this.pslConfig, parsed.publicSuffixList);
  }

  requireConfiguredUrl(value, configPath) {
    const url = String(value || '').trim();
    const urlPattern = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
    const hostLikePattern = /^(?:http(?:s?):\/\/(?:www\.)?)?([A-Za-z0-9_:.-]+)\/?$/;
    if (!urlPattern.test(url) && !hostLikePattern.test(url)) {
      throw new Error(`Missing or invalid URL config "${configPath}" in ${config.urlConfigFile}`);
    }
    return url;
  }

  printLicenseBanner() {
    const banner = [
      '',
      '============================================================',
      'first modified by subham mahesh on 13 feb 2026 - 17:30 IST',
      'licensed under GNU LGPL-3.0-or-later',
      'original code by Kevin Röbert (ClearURLs)',
      '* ClearURLs',
      '* Copyright (c) 2017-2020 Kevin Röbert',
      '*',
      '* This program is free software: you can redistribute it and/or modify',
      '* it under the terms of the GNU Lesser General Public License as published by',
      '* the Free Software Foundation, either version 3 of the License, or',
      '* (at your option) any later version.',
      '*',
      '* This program is distributed in the hope that it will be useful,',
      '* but WITHOUT ANY WARRANTY; without even the implied warranty of',
      '* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
      '* GNU Lesser General Public License for more details.',
      '*',
      '* You should have received a copy of the GNU Lesser General Public License',
      '* along with this program.  If not, see <http://www.gnu.org/licenses/>.',
      '*',
      '* To view the full modification history of both script and extension source code of lgpl code, run:',
      '*',
      '*  bun linkumori-cli-tool.js', 
      '* node linkumori-cli-tool.js',
      '*',
      '* Then select "Generate Commit History". This will create a Markdown file',
      '* where you can browse who modified which files and on what date.',
      '* some modification notice may not shown in in md file please open file to see old notice',
      '============================================================',
      ''
    ].join('\n');

    console.log(banner);
  }

  // Utility methods for colored output
  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  success(message) {
    this.log(`✓ ${message}`, 'green');
  }

  error(message) {
    this.log(`✗ ${message}`, 'red');
  }

  warning(message) {
    this.log(`! ${message}`, 'yellow');
  }

  info(message) {
    this.log(`ℹ ${message}`, 'blue');
  }

  header(message) {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log(`${colors.bold}${message}${colors.reset}`, 'cyan');
    this.log('='.repeat(60), 'cyan');
  }

  section(message) {
    this.log(`\n${colors.bold}${colors.blue}▶ ${message}${colors.reset}`);
  }

  // Environment management
  loadEnvironment() {
    const requiredKeys = [
      'WEB_EXT_API_KEY',
      'WEB_EXT_API_SECRET',
      'WEB_EXT_CHANNEL',
      'WEB_EXT_APPROVAL_TIMEOUT'
    ];

    let envFileExists = false;
    try {
      fs.statSync(config.envFile);
      envFileExists = true;
    } catch {
      // .env does not exist
    }

    if (envFileExists) {
      try {
        const envContent = fs.readFileSync(config.envFile, 'utf8');
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=');
              this.env[key] = value;
              process.env[key] = value;
            }
          }
        }
        this.info(`Loaded environment from ${config.envFile}`);
      } catch (error) {
        this.warning(`Failed to read ${config.envFile}: ${error.message}`);
      }
    } else {
      this.info(`No ${config.envFile} file found, falling back to environment variables (GitHub Actions secrets)`);
      let loaded = 0;
      for (const key of requiredKeys) {
        if (process.env[key]) {
          this.env[key] = process.env[key];
          loaded++;
        }
      }
      if (loaded > 0) {
        this.success(`Loaded ${loaded}/${requiredKeys.length} credentials from environment variables`);
      } else {
        this.warning('No credentials found in environment variables either');
        this.info('Set GitHub Actions secrets: WEB_EXT_API_KEY, WEB_EXT_API_SECRET, WEB_EXT_CHANNEL');
      }
    }
  }

  // Execute shell commands with working directory support
  async exec(cmd, args = [], options = {}) {
    const showOutput = options.showOutput || false;
    
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: options.cwd,
        stdio: showOutput ? ['inherit', 'pipe', 'pipe'] : 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (showOutput) {
          process.stdout.write(text);
        }
      });
      
      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (showOutput) {
          process.stderr.write(text);
        }
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr
        });
      });
      
      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }

  // Check dependencies
  async checkDependencies() {
    this.section('Checking Dependencies');
    
    const deps = [
      { name: 'bun', required: true, installable: false, installCmd: null },
      { name: 'npm', required: true, installable: false, installCmd: null },
      { name: 'web-ext', required: true, installable: true, installCmd: ['bun', 'install', '-g', 'web-ext'] },
      { name: 'fontforge', required: false, note: 'for Old Country Nobility Font', installable: false, installCmd: null },
      { name: 'rsvg-convert', required: false, note: 'for SVG icon generation', installable: false, installCmd: null }
    ];

    let allRequired = true;
    const missingInstallable = [];
    
    for (const dep of deps) {
      const result = await this.exec('which', [dep.name]);
      if (result.success) {
        const version = await this.exec(dep.name, ['--version']);
        const versionText = version.output.split('\n')[0] || 'unknown';
        this.success(`${dep.name}: ${versionText}`);
      } else {
        if (dep.required) {
          this.error(`${dep.name}: not found (required)`);
          allRequired = false;
          if (dep.installable) {
            missingInstallable.push(dep);
          } else {
            this.info(`  Please install ${dep.name} manually`);
          }
        } else {
          this.warning(`${dep.name}: not found (${dep.note})`);
          if (!dep.required && dep.name === 'fontforge') {
            this.info('  Ubuntu/Debian: sudo apt-get install fontforge');
            this.info('  macOS: brew install fontforge');
            this.info('  Fedora: sudo dnf install fontforge');
          } else if (!dep.required && dep.name === 'rsvg-convert') {
            this.info('  Ubuntu/Debian: sudo apt-get install librsvg2-bin');
            this.info('  macOS: brew install librsvg');
            this.info('  Fedora: sudo dnf install librsvg2-tools');
          }
        }
      }
    }
    
    // Show installation instructions for missing dependencies
    if (missingInstallable.length > 0) {
      this.section('Missing Dependencies - Manual Installation Required');
      
      for (const dep of missingInstallable) {
        this.error(`${dep.name} is required but not found`);
        this.info(`Install with: ${dep.installCmd.join(' ')}`);
      }
      
      this.info('\nPlease install missing dependencies and run again.');
    }
    
    return allRequired;
  }

  // LICENSE DOCUMENTATION GENERATOR METHODS
  
  /**
   * Fetch a license from local file
   */
  async fetchLicense(licenseType) {
    // Return from cache if available
    if (this.licenseConfig.cache[licenseType]) {
      return this.licenseConfig.cache[licenseType];
    }

    const filePath = this.licenseConfig.sources[licenseType];
    
    if (!filePath) {
      throw new Error(`Unknown license type: ${licenseType}`);
    }
    
    try {
      // Check if file exists
      try {
        fs.statSync(filePath);
      } catch {
        throw new Error(`License file not found: ${filePath}\nPlease ensure all license files are in the 'licenses/' directory.`);
      }
      
      // Read license text from local file
      const licenseText = fs.readFileSync(filePath, 'utf8');
      
      if (!licenseText || licenseText.trim().length === 0) {
        throw new Error(`License file is empty: ${filePath}`);
      }
      
      this.licenseConfig.cache[licenseType] = licenseText;
      this.info(`  ✓ Loaded ${licenseType} from ${filePath}`);
      return licenseText;
    } catch (error) {
      this.error(`Failed to load ${licenseType} license: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch all licenses concurrently
   */
  async fetchAllLicenses() {
    const licenseTypes = Object.keys(this.licenseConfig.sources);
    
    this.info(`Loading ${licenseTypes.length} license files from local directory...`);
    
    const promises = licenseTypes.map(type => 
      this.fetchLicense(type)
        .then(text => ({ type, text, success: true }))
        .catch(error => ({ type, text: null, success: false, error: error.message }))
    );

    const results = await Promise.all(promises);
    const allLicenses = {};
    const failed = [];
    
    results.forEach(({ type, text, success, error }) => {
      if (success) {
        allLicenses[type] = text;
      } else {
        failed.push({ type, error });
      }
    });
    
    if (failed.length > 0) {
      this.error(`Failed to load ${failed.length} license(s):`);
      failed.forEach(({ type, error }) => {
        this.error(`  ${type}: ${error}`);
      });
      throw new Error('Some license files could not be loaded. Please ensure all license files exist in the licenses/ directory.');
    }

    return allLicenses;
  }

  /**
   * Get current time with device timezone
   */
  getCurrentTimeWithTimezone() {
    const now = new Date();
    
    // Get timezone offset in hours and minutes
    const offset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetSign = offset >= 0 ? '+' : '-';
    
    // Format: YYYY-MM-DD HH:MM:SS UTC+XX:XX
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timezoneOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC${timezoneOffset} (${timezoneName})`;
  }

  /**
   * Process markdown document and replace license placeholders
   */
  async processLicenseDocument(markdownContent) {
    // Fetch all licenses first
    const licenses = await this.fetchAllLicenses();

    // Replace placeholders with license texts
    let processedContent = markdownContent;

    // Replace license placeholders
    Object.keys(licenses).forEach(licenseType => {
      const placeholder = `{{LICENSE:${licenseType}}}`;
      const licenseText = licenses[licenseType];
      
      // Use raw license text without code block formatting
      const formattedLicense = licenseText;
      
      // Replace all occurrences
      processedContent = processedContent.split(placeholder).join(formattedLicense);
    });

    // Replace time placeholder
    const currentTime = this.getCurrentTimeWithTimezone();
    processedContent = processedContent.split('{{CURRENT-TIME-WITH-DEVICE-TIME-ZONE}}').join(currentTime);

    return processedContent;
  }

  /**
   * Generate copyright documentation with embedded licenses
   */
  async generateCopyrightDocumentation() {
    this.section('Generating Copyright Documentation');
    
    try {
      // Check if template exists
      try {
        fs.statSync(config.licenseTemplateFile);
      } catch {
        this.warning(`License template not found: ${config.licenseTemplateFile}`);
        this.info('Skipping license documentation generation');
        return false;
      }
      
      // Check if licenses directory exists
      try {
        fs.statSync('licenses');
      } catch {
        this.error('licenses/ directory not found!');
        this.info('Please create the licenses/ directory and add the following files:');
        Object.entries(this.licenseConfig.sources).forEach(([type, path]) => {
          this.info(`  - ${path}`);
        });
        this.info('\nRun "setup" command to create license directory structure.');
        return false;
      }

      // Read template
      this.info(`Reading template: ${config.licenseTemplateFile}`);
      const template = fs.readFileSync(config.licenseTemplateFile, 'utf8');

      // Fetch and embed licenses from local files
      this.info('Loading license texts from local files...');
      const processed = await this.processLicenseDocument(template);

      // Ensure output directory exists
      if (config.licenseOutputDir) {
        try {
          fs.mkdirSync(config.licenseOutputDir, { recursive: true });
        } catch {
          // Directory already exists
        }
      }

      // Determine output path
      const outputPath = config.licenseOutputDir 
        ? `${config.licenseOutputDir}/${config.licenseOutputFile}`
        : config.licenseOutputFile;

      // Write processed document
      fs.writeFileSync(outputPath, processed);
      
      const sizeKB = Math.round(new TextEncoder().encode(processed).length / 1024);
      this.success(`Copyright documentation generated: ${outputPath} (${sizeKB}KB)`);

      // Show license status
      const licenseCount = Object.keys(this.licenseConfig.cache).length;
      this.info(`Embedded ${licenseCount} license texts`);
      
      for (const [licenseType, text] of Object.entries(this.licenseConfig.cache)) {
        const size = Math.round(new TextEncoder().encode(text).length / 1024);
        this.info(`  ${licenseType}: ${size}KB`);
      }

      return true;
    } catch (error) {
      this.error(`Failed to generate copyright documentation: ${error.message}`);
      return false;
    }
  }

  /**
   * Create copyright template file
   */
  createCopyrightTemplate() {
    const template = `# LINKUMORI
## Copyright and Attribution Documentation

**Generated:** {{CURRENT-TIME-WITH-DEVICE-TIME-ZONE}}

---

## Table of Contents

1. [First-Party Components](#1-first-party-components)
2. [License Information](#2-license-information)

---

## 1. First-Party Components

**Description:** Original components developed without third-party dependencies.

### 1.1 Copyright & License

**Copyright:** © ${new Date().getFullYear()} Subham Mahesh

**License:** GNU Lesser General Public License (LGPL) v3.0 or later

{{LICENSE:LGPL-3.0}}

---

## 2. License Information

### 2.1 GNU Lesser General Public License (LGPL)

**Version:** 3.0 or later  
**Type:** Copyleft open source license  
**Full Text:** <http://www.gnu.org/licenses/>

{{LICENSE:LGPL-3.0}}

### 2.2 MIT License

**Type:** Permissive open source license

{{LICENSE:MIT}}

### 2.3 Apache License 2.0

**Type:** Permissive open source license

{{LICENSE:APACHE-2.0}}

### 2.4 Creative Commons Zero (CC0 1.0 Universal)

**Type:** Public domain dedication

{{LICENSE:CC0-1.0}}

### 2.5 ISC License

**Type:** Permissive open source license

{{LICENSE:ISC}}

### 2.6 Mozilla Public License 2.0

**Type:** File-level copyleft open source license

{{LICENSE:MPL-2.0}}

### 2.7 The Unlicense

**Type:** Public domain dedication

{{LICENSE:UNLICENSE}}

### 2.8 MarkedJS License Notice

**Type:** Project-specific third-party attribution notice

{{LICENSE:MARKEDJS}}

---

**Document Generated:** {{CURRENT-TIME-WITH-DEVICE-TIME-ZONE}}

*End of Document*
`;

    try {
      fs.writeFileSync(config.licenseTemplateFile, template);
      this.success(`Created copyright template: ${config.licenseTemplateFile}`);
      this.info('Edit this template with your actual copyright information');
      this.info('Available placeholders:');
      this.info('  {{LICENSE:TYPE}} - Embeds license text');
      this.info('  {{LICENSE:MARKEDJS}} - Embeds the MarkedJS attribution notice');
      this.info('  {{CURRENT-TIME-WITH-DEVICE-TIME-ZONE}} - Current timestamp with timezone');
      this.info('Then run build to generate the full documentation');
    } catch (error) {
      this.error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Create licenses directory structure with README
   */
  createLicensesDirectory() {
    this.section('Creating Licenses Directory Structure');
    
    try {
      // Create licenses directory
      fs.mkdirSync('licenses', { recursive: true });
      this.success('Created licenses/ directory');
      
      // Create README file
      const readmeContent = `# License Files Directory

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
`;
      
      fs.writeFileSync('licenses/README.md', readmeContent);
      this.success('Created licenses/README.md with download instructions');
      
      this.info('\nNext steps:');
      this.info('1. Navigate to the licenses/ directory');
      this.info('2. Download the required license files from the sources listed in README.md');
      this.info('3. Save them with the correct filenames (.txt extension)');
      this.info('4. Run build to generate copyright documentation');
      
      return true;
    } catch (error) {
      this.error(`Failed to create licenses directory: ${error.message}`);
      return false;
    }
  }

  // ENHANCED ClearURLs Builder Methods (from superior script)
  
  // Generate version based on current date and time
  generateVersion() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year}.${hours}${minutes}`;
  }

  // Create Linkumori metadata
  createLinkumoriMetadata() {
    return {
      "metadata": {
        "name": "Linkumori URL Cleaning Rules",
        "version": this.generateVersion(),
        "buildTimestamp": new Date().toISOString(),
        "description": "Comprehensive URL cleaning rules for tracking parameter removal and privacy protection",
        "license": "GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.",
        "license-Url": "https://www.gnu.org/licenses/lgpl-3.0.en.html",
        "SPDX-Identifier": "https://spdx.org/licenses/LGPL-3.0-or-later.html",
        "project": "Linkumori",
        "originalProject": "ClearURLs",
        "first-modified-By": "Subham Mahesh in 2026 with significant enhancements and optimizations",
        "copyright": "Copyright (c) 2025-2026 Subham Mahesh for Linkumori modifications and curated additions; ClearURLs Rules portions remain copyright their respective ClearURLs authors and contributors, including Kevin Röbert where applicable.",
        "Notice-Of-Modification": "See data/NOTICE.md and sidecar notices for linkumori-clearurls.json, linkumori-clearurls-min.json.lz4, custom-rules.json, and downloaded-official-rules.json.",
        "sourceLineage": {
          "canonicalSource": "data/linkumori-clearurls.json",
          "generatedBundle": "data/linkumori-clearurls-min.json.lz4",
          "migratedFrom": [
            "data/downloaded-official-rules.json",
            "data/custom-rules.json",
            "data/linkumori-clearurls-min.json.lz4"
          ],
          "carriesHistoricalModifications": true,
          "noticeFiles": [
            "data/NOTICE.md",
            "data/linkumori-clearurls.json.txt",
            "data/linkumori-clearurls-min.json.lz4.txt",
            "data/custom-rules.json.txt",
            "data/downloaded-official-rules.json.txt"
          ]
        },
        "urls": {
          "repository": "https://github.com/Linkumori/Linkumori-Addon",
          "homepage": "https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/",
          "orginal-clearurls-rulesSource-URL": "https://github.com/ClearURLs/Rules",
          "cleaurls-repo-addon": "https://github.com/ClearURLs/Addon",
          "License-URL": "https://www.gnu.org/licenses/lgpl-3.0.en.html",
          "issues": "https://github.com/Linkumori/Linkumori-Addon/issues"
        }
      }
    };
  }

  countPslRules(listText) {
    return String(listText || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .length;
  }

  async updatePublicSuffixList(mode = 'auto') {
    this.section('🌐 Public Suffix List (PSL) Update');

    let useOffline = false;
    const localFile = this.pslConfig.localFile;
    const onlineUrl = this.requireConfiguredUrl(
      this.pslConfig.listUrl,
      'publicSuffixList.listUrl'
    );

    const localExists = (() => {
      try {
        fs.statSync(localFile);
        return true;
      } catch {
        return false;
      }
    })();

    if (mode === 'offline') {
      useOffline = true;
    } else if (mode === 'online') {
      useOffline = false;
    } else if (localExists && this.isInteractive()) {
      const stats = fs.statSync(localFile);
      this.log('');
      this.info(`📁 Found local PSL file: ${localFile}`);
      this.info(`   Last modified: ${new Date(stats.mtime).toLocaleString()}`);
      this.log('');
      this.log('Choose PSL mode:', 'cyan');
      this.log(`  1) 🌐 Online  – Download latest PSL data (recommended) Read legal document ${this.pslConfig.projectUrl || onlineUrl} `, 'white');
      this.log('  2) 💾 Offline – Use existing local PSL file', 'white');
      this.log('');
      process.stdout.write('Enter your choice (1 or 2, default=1): ');
      const choice = await this.getInput();
      useOffline = choice === '2';
      this.info(useOffline ? '💾 Selected: Offline mode' : '🌐 Selected: Online mode');
    } else {
      useOffline = false;
      this.info('🌐 Auto mode: selecting online update');
    }

    if (useOffline) {
      try {
        const content = fs.readFileSync(localFile, 'utf8');
        const ruleCount = this.countPslRules(content);
        this.success(`✅ Loaded local PSL file: ${localFile}`);
        this.info(`📊 Rules available: ${ruleCount}`);
        return true;
      } catch (error) {
        this.error(`❌ Local PSL file unavailable: ${localFile}`);
        this.error(`Reason: ${error.message}`);
        this.info('Run in online mode once to download the PSL file.');
        return false;
      }
    }

    this.info(`📥 Fetching latest PSL from: ${onlineUrl}`);
    try {
      const response = await fetch(onlineUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      const ruleCount = this.countPslRules(content);
      if (ruleCount === 0) {
        throw new Error('Downloaded PSL data appears empty or invalid');
      }

      try {
        fs.mkdirSync('data', { recursive: true });
      } catch {
        // Directory already exists
      }

      fs.writeFileSync(localFile, content);
      this.success(`✅ PSL downloaded and saved to: ${localFile}`);
      this.info(`📊 Rules downloaded: ${ruleCount}`);
      return true;
    } catch (error) {
      this.error(`❌ Failed to download PSL: ${error.message}`);
      return false;
    }
  }

  normalizePslMode(mode) {
    const value = String(mode || 'auto').toLowerCase().trim();
    if (!value || value === 'auto') return 'auto';
    if (value === 'online') return 'online';
    if (value === 'offline') return 'offline';
    throw new Error(`Invalid PSL mode "${mode}". Use: online, offline, or auto.`);
  }

  async ensurePslReady(mode = 'auto') {
    const normalizedMode = this.normalizePslMode(mode);
    if (this.pslPrepared && (normalizedMode === 'auto' || normalizedMode === this.pslPreparedMode)) {
      this.info(`PSL already prepared (${this.pslPreparedMode || 'auto'})`);
      return true;
    }

    const ok = await this.updatePublicSuffixList(normalizedMode);
    if (ok) {
      this.pslPrepared = true;
      this.pslPreparedMode = normalizedMode;
    }
    return ok;
  }

  // Load the canonical ClearURLs source JSON.
  loadClearURLsSourceRules(filePath) {
    this.info(`📂 Loading ClearURLs source rules from: ${filePath}`);
    
    try {
      fs.statSync(filePath);
    } catch {
      this.error(`❌ ClearURLs source file not found: ${filePath}`);
      this.info(`Create ${this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile} first.`);
      return null;
    }
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('ClearURLs source must be an object');
      }

      const hasWrappedShape = Object.prototype.hasOwnProperty.call(parsed, 'providers')
        || Object.prototype.hasOwnProperty.call(parsed, 'metadata');
      const providers = hasWrappedShape ? (parsed.providers || {}) : parsed;

      if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
        throw new Error('ClearURLs providers must be an object');
      }

      const metadata = parsed.metadata
        && typeof parsed.metadata === 'object'
        && !Array.isArray(parsed.metadata)
        ? parsed.metadata
        : {};
      this.success(`✅ Loaded ${Object.keys(providers).length} providers`);

      return {
        metadata,
        providers
      };
    } catch (error) {
      this.error(`❌ Error loading ClearURLs source rules: ${error.message}`);
      return null;
    }
  }

  // Load the shared rule-syntax module (core_js/rule_syntax.js) once.
  getRuleSyntax() {
    if (!this._ruleSyntax) {
      const context = { console };
      vm.createContext(context);
      vm.runInContext(fs.readFileSync('core_js/rule_syntax.js', 'utf8'), context, { filename: 'core_js/rule_syntax.js' });
      this._ruleSyntax = context.LinkumoriRuleSyntax;
    }
    return this._ruleSyntax;
  }

  // Normalize every provider to the unified "match" + "rules" syntax
  // (docs/rule-syntax.md), converting older-format providers and dropping
  // empty/default fields. Invalid rules abort the build.
  minifyRules(data) {
    this.info('🗜️  Normalizing rules to the unified syntax...');

    const syntax = this.getRuleSyntax();
    const minifiedData = { providers: {} };
    const errors = [];
    let convertedProviders = 0;
    let removedProviders = 0;

    for (const [name, source] of Object.entries(data.providers || {})) {
      if (!syntax.isCanonicalProvider(source)) convertedProviders++;
      const provider = syntax.isCanonicalProvider(source) ? source : syntax.toCanonicalProvider(source);
      const self = { match: provider.match };
      if (Array.isArray(provider.rules) && provider.rules.length > 0) self.rules = provider.rules;
      if (Array.isArray(provider.methods) && provider.methods.length > 0) self.methods = provider.methods;
      if (Array.isArray(provider.resourceTypes) && provider.resourceTypes.length > 0) self.resourceTypes = provider.resourceTypes;
      // Defaults are true, so only the non-default false is worth keeping.
      if (provider.active === false) self.active = false;
      if (provider.historyBypassProtection === false) self.historyBypassProtection = false;

      if (!self.rules && (!Array.isArray(self.match) || self.match.length === 0)) {
        removedProviders++;
        continue;
      }
      errors.push(...syntax.validateProvider(self, name));
      minifiedData.providers[name] = self;
    }

    if (errors.length > 0) {
      errors.forEach(error => this.error(`   • ${error}`));
      throw new Error(`${errors.length} invalid rule(s)`);
    }
    if (convertedProviders > 0) this.info(`🔁 Converted ${convertedProviders} older-format provider(s)`);
    this.success(`✅ Normalization complete: ${removedProviders} empty providers removed`);
    return minifiedData;
  }

  // Format rule JSON with readable top-level sections and one-line providers.
  formatMinifiedOutput(data, options = {}) {
    const includeMetadata = options.includeMetadata !== false;
    const metadata = data.metadata || {};
    const providers = data.providers || {};

    const metadataJson = JSON.stringify(metadata, null, 2);
    const metadataInline = metadataJson.replace(/\n/g, '\n  ');

    const providerEntries = Object.entries(providers);
    const providerLines = providerEntries
      .map(([providerName, providerData]) => `    ${JSON.stringify(providerName)}: ${JSON.stringify(providerData)}`)
      .join(',\n');

    const providersBlock = providerLines ? `\n${providerLines}\n` : '\n';

    const metadataBlock = includeMetadata
      ? `  "metadata": ${metadataInline},\n`
      : '';

    return `{\n${metadataBlock}  "providers": {${providersBlock}  }\n}\n`;
  }

  loadLZ4Codec() {
    const context = {
      Buffer,
      TextDecoder,
      TextEncoder,
      Uint8Array,
      module: { exports: {} },
      globalThis: null
    };
    context.globalThis = context;

    vm.runInNewContext(fs.readFileSync('external_js/linkumori_lz4_block.js', 'utf8'), context, {
      filename: 'external_js/linkumori_lz4_block.js'
    });

    return context.module.exports || context.LinkumoriLZ4;
  }

  writeLZ4CompressedFile(inputFile, outputFile = `${inputFile}.lz4`) {
    const codec = this.loadLZ4Codec();
    const input = fs.readFileSync(inputFile);
    const compressed = codec.compress(input);
    fs.writeFileSync(outputFile, compressed);

    return {
      outputFile,
      inputSize: input.length,
      outputSize: compressed.length,
      ratio: input.length > 0 ? compressed.length / input.length : 1
    };
  }

  writeLZ4CompressedContent(content, outputFile) {
    const codec = this.loadLZ4Codec();
    const input = Buffer.from(String(content || ''), 'utf8');
    const compressed = codec.compress(input);
    fs.writeFileSync(outputFile, compressed);

    return {
      outputFile,
      inputSize: input.length,
      outputSize: compressed.length,
      ratio: input.length > 0 ? compressed.length / input.length : 1
    };
  }

  readMaybeLZ4Text(filePath) {
    if (String(filePath || '').endsWith('.lz4')) {
      const codec = this.loadLZ4Codec();
      return codec.decompressToString(fs.readFileSync(filePath));
    }

    return fs.readFileSync(filePath, 'utf8');
  }

  resolveRulesFile(preferredFile = null) {
    if (preferredFile && fs.existsSync(preferredFile)) return preferredFile;
    if (preferredFile) return preferredFile;

    const sourceFile = this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile;
    if (sourceFile && fs.existsSync(sourceFile)) return sourceFile;
    if (this.clearurlsConfig.compressedRulesFile && fs.existsSync(this.clearurlsConfig.compressedRulesFile)) {
      return this.clearurlsConfig.compressedRulesFile;
    }

    return sourceFile || 'data/linkumori-clearurls.json';
  }

  // Unminify rules from compressed/minified rules file
  async unminifyClearURLs(options = {}) {
    this.section('📤 Unminifying ClearURLs Rules');

    const {
      inputFile = this.clearurlsConfig.compressedRulesFile,
      outputFile = `data/${this.clearurlsConfig.outputBaseName}-clearurls-unminified.json`
    } = options;

    try {
      // Check if input file exists
      try {
        fs.statSync(inputFile);
      } catch {
        this.error(`❌ LZ4 rules file not found: ${inputFile}`);
        this.info('Build the ClearURLs rules first to create the compressed rules file.');
        return false;
      }

      this.info(`📂 Reading rules file: ${inputFile}`);

      // Read and parse compressed/minified file
      const minifiedContent = this.readMaybeLZ4Text(inputFile);
      const minifiedData = JSON.parse(minifiedContent);

      // Write unminified version with pretty formatting
      fs.writeFileSync(outputFile, JSON.stringify(minifiedData, null, 2));

      const inputSize = new TextEncoder().encode(minifiedContent).length;
      const outputSize = new TextEncoder().encode(JSON.stringify(minifiedData, null, 2)).length;

      this.success(`✅ Unminified rules saved to: ${outputFile}`);
      this.info(`📊 JSON payload size: ${Math.round(inputSize / 1024)}KB`);
      this.info(`📊 Unminified size: ${Math.round(outputSize / 1024)}KB`);
      this.info(`📈 Size increase: ${Math.round((outputSize - inputSize) / 1024)}KB (${(((outputSize - inputSize) / inputSize) * 100).toFixed(1)}%)`);

      return true;
    } catch (error) {
      this.error(`❌ Error unminifying rules: ${error.message}`);
      return false;
    }
  }

  // Create markdown file with formatted git commit history
  async createCommitHistoryMarkdown(options = {}) {
    this.section('📜 Creating Commit History Markdown');

    const {
      outputFile = 'COMMIT_HISTORY.md',
      branch = 'HEAD',
      limit = 0
    } = options;

    try {
      // Check if we're in a git repository
      const gitCheck = await this.exec('git', ['rev-parse', '--git-dir']);
      if (!gitCheck.success) {
        this.error('❌ Not a git repository');
        this.info('Initialize a git repository first with: git init');
        return false;
      }

      this.info(`📥 Fetching commit history from: ${branch}`);

      // Build git log command
      const gitArgs = [
        'log',
        branch,
        '--format=%H|%an|%ae|%ad|%s',
        '--date=iso',
        '--name-status'
      ];

      if (limit > 0) {
        gitArgs.push(`-${limit}`);
      }

      const logResult = await this.exec('git', gitArgs);

      if (!logResult.success) {
        this.error('❌ Failed to fetch git log');
        this.error(logResult.error);
        return false;
      }

      // Parse git log output
      const commits = this.parseGitLog(logResult.output);

      if (commits.length === 0) {
        this.warning('⚠️  No commits found in the repository');
        return false;
      }

      this.info(`📊 Found ${commits.length} commit(s)`);

      // Generate markdown content
      const markdown = this.generateCommitMarkdown(commits);

      // Write to file
      fs.writeFileSync(outputFile, markdown);

      const fileSize = new TextEncoder().encode(markdown).length;
      this.success(`✅ Commit history saved to: ${outputFile}`);
      this.info(`📁 File size: ${Math.round(fileSize / 1024)}KB`);
      this.info(`📝 Total commits: ${commits.length}`);

      return true;
    } catch (error) {
      this.error(`❌ Error creating commit history: ${error.message}`);
      return false;
    }
  }

  // Parse git log output into structured commit objects
  parseGitLog(logOutput) {
    const commits = [];
    const lines = logOutput.split('\n');
    let currentCommit = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Check if this is a commit info line (contains pipe separators)
      if (line.includes('|')) {
        // Save previous commit if exists
        if (currentCommit) {
          commits.push(currentCommit);
        }

        // Parse new commit
        const parts = line.split('|');
        currentCommit = {
          hash: parts[0] || '',
          author: parts[1] || 'Unknown',
          email: parts[2] || '',
          date: parts[3] || '',
          message: parts[4] || 'No commit message',
          files: []
        };
      } else if (currentCommit && line.match(/^[AMDRC]\s+/)) {
        // This is a file change line
        const match = line.match(/^([AMDRC])\s+(.+)$/);
        if (match) {
          const status = match[1];
          const file = match[2];
          const statusMap = {
            'A': 'Added',
            'M': 'Modified',
            'D': 'Deleted',
            'R': 'Renamed',
            'C': 'Copied'
          };
          currentCommit.files.push({
            status: statusMap[status] || status,
            path: file
          });
        }
      }
    }

    // Don't forget the last commit
    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }

  // Generate markdown content from commits
  generateCommitMarkdown(commits) {
    const now = new Date().toISOString();
    let markdown = `# Git Commit History

**Generated**: ${now}
**Total Commits**: ${commits.length}

---

`;

    commits.forEach((commit, index) => {
      markdown += `## Commit ${index + 1}: ${commit.message}

**Author**: ${commit.author} <${commit.email}>
**Date**: ${commit.date}
**Commit Hash**: \`${commit.hash}\`
**Short Hash**: \`${commit.hash.substring(0, 7)}\`

### Files Modified

`;

      if (commit.files.length === 0) {
        markdown += `*No files modified in this commit*\n\n`;
      } else {
        commit.files.forEach(file => {
          markdown += `- **${file.status}**: \`${file.path}\`\n`;
        });
        markdown += '\n';
      }

      markdown += `### Commit Message

\`\`\`text
${commit.message}
\`\`\`

---

`;
    });

    markdown += `
*End of Commit History*

**Generated by Linkumori CLI** - ${now}
`;

    return markdown;
  }

  // Create Linkumori JSON with metadata
  createLinkumoriJSON(originalData) {
    this.info('🔖 Adding Linkumori metadata...');
    
    const linkumoriMetadata = this.createLinkumoriMetadata();
    const version = linkumoriMetadata.metadata.version;
    const buildTime = linkumoriMetadata.metadata.buildTimestamp;
    const originalMetadata = originalData?.metadata
      && typeof originalData.metadata === 'object'
      && !Array.isArray(originalData.metadata)
      ? originalData.metadata
      : {};
    
    this.info(`  📅 Version: ${version}`);
    this.info(`  🕒 Build time: ${buildTime}`);
    
    return {
      ...originalData,
      metadata: {
        ...originalMetadata,
        ...linkumoriMetadata.metadata
      }
    };
  }

  // Lint a ClearURLs rules JSON file by replaying clearurls.js logic.
  // Accepts both formats:
  //   • wrapped { metadata?, providers } ← linkumori-clearurls.json
  //   • flat  { providerName: { match, rules, ... }, ... }
  async lintClearURLsRules(rulesFile = null) {
    this.section('🔍 ClearURLs Rules Linter');

    // ── 0. File selection prompt ──────────────────────────────────────────────
    if (rulesFile === null) {
      const sourceFile = this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile;
      const bundledFile = this.clearurlsConfig.compressedRulesFile;
      const sourceExists = fs.existsSync(sourceFile);
      const bundledExists = fs.existsSync(bundledFile);

      if (this.isInteractive()) {
        this.log('');
        this.log('Which file do you want to lint?', 'cyan');
        this.log('');
        this.log(`  1) 📝 Source rules   — ${sourceFile}${sourceExists ? '' : '  (not found)'}`, 'white');
        this.log(`  2) 📦 Bundled LZ4    — ${bundledFile}${bundledExists ? '' : '  (not found)'}`, 'white');
        this.log('');
        process.stdout.write('Enter your choice (1 or 2, default=1): ');
        const choice = await this.getInput();

        if (choice === '2') {
          rulesFile = bundledFile;
          this.info(`📦 Selected: ${bundledFile}`);
        } else {
          rulesFile = sourceFile;
          this.info(`📝 Selected: ${sourceFile}`);
        }
        this.log('');
      } else {
        // Non-interactive (piped / CI): default to canonical source JSON.
        rulesFile = sourceFile;
      }
    }

    this.info(`📂 Target file: ${rulesFile}`);

    // ── 1. File exists ────────────────────────────────────────────────────────
    if (!fs.existsSync(rulesFile)) {
      this.error(`❌ Rules file not found: ${rulesFile}`);
      if (rulesFile === (this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile)) {
        this.info('Edit data/linkumori-clearurls.json to add or update bundled rules.');
      } else {
        this.info('Run the "clearurls" command first to build the rules file.');
      }
      return false;
    }

    // ── 2. JSON parse ─────────────────────────────────────────────────────────
    let data;
    try {
      const raw = this.readMaybeLZ4Text(rulesFile);
      data = JSON.parse(raw);
    } catch (err) {
      this.error(`❌ JSON parse error: ${err.message}`);
      return false;
    }

    // ── 3. Auto-detect format and extract providers object ────────────────────
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.error('❌ Root must be a JSON object');
      return false;
    }

    let providersObj;
    let formatLabel;
    if (data.providers && typeof data.providers === 'object' && !Array.isArray(data.providers)) {
      // Wrapped format: { metadata?, providers }
      providersObj = data.providers;
      formatLabel  = 'wrapped unified ClearURLsData';
    } else {
      // Flat format: { providerName: { match, rules, ... }, ... }
      // Validate that values look like provider objects (not metadata fields)
      const values = Object.values(data);
      const looksFlat = values.every(v => v === null || typeof v === 'object');
      if (!looksFlat) {
        this.error('❌ Cannot determine JSON format — root values must be provider objects');
        return false;
      }
      providersObj = data;
      formatLabel  = 'flat legacy provider map';
    }

    const providerEntries = Object.entries(providersObj);
    this.info(`📋 Format detected: ${formatLabel}`);
    this.info(`📦 Providers found: ${providerEntries.length}`);

    const errors   = [];
    const warnings = [];
    let totalRulesChecked = 0;

    const parseRegexLiteral = (value) => {
      const text = String(value || '').trim();
      if (!text.startsWith('/')) return null;
      const closingSlash = text.lastIndexOf('/');
      if (closingSlash <= 0) return null;
      const body = text.slice(1, closingSlash);
      const flags = text.slice(closingSlash + 1);
      return { body, flags };
    };

    const getRulePattern = (rule) => {
      if (typeof rule === 'string') return rule;
      if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
        if (typeof rule.match === 'string') return rule.match;
        if (typeof rule.matchPattern === 'string') return rule.matchPattern;
      }
      return '';
    };

    const isRemoveParamRule = (rule) => (
      /\$(?:[^,\s]*,)*removeparam(?:[=,\s]|$)/i.test(getRulePattern(rule))
    );

    const splitRemoveParamModifiers = (modifiersText) => {
      const parts = [];
      let current = '';
      let inRegex = false;
      let escaped = false;
      const text = String(modifiersText || '');

      for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        const next = i + 1 < text.length ? text.charAt(i + 1) : '';

        if (!inRegex) {
          if (ch === ',') {
            if (current.trim()) parts.push(current.trim());
            current = '';
            continue;
          }

          current += ch;
          if (ch === '=' && next === '/') {
            current += '/';
            inRegex = true;
            escaped = false;
            i++;
          }
          continue;
        }

        current += ch;
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '/') {
          inRegex = false;
        }
      }

      if (current.trim()) parts.push(current.trim());
      return parts;
    };

    const getRemoveParamValue = (rule) => {
      const rulePattern = getRulePattern(rule);
      const modifierStart = rulePattern.indexOf('$');
      if (modifierStart === -1) return null;
      const modifiers = splitRemoveParamModifiers(rulePattern.slice(modifierStart + 1));
      const token = modifiers.find(part => /^removeparam(?:=|$)/i.test(part.trim()));
      if (!token) return null;
      const eqIndex = token.indexOf('=');
      return eqIndex === -1 ? '' : token.slice(eqIndex + 1).trim();
    };

    const removeParamRuleMatchesKey = (rule, key) => {
      const value = getRemoveParamValue(rule);
      if (value === null) return false;
      if (value === '') return true;

      let normalizedValue = value;
      let negate = false;
      if (normalizedValue.startsWith('~')) {
        negate = true;
        normalizedValue = normalizedValue.slice(1).trim();
      }

      let matched = false;
      const regexLiteral = parseRegexLiteral(normalizedValue);
      if (regexLiteral) {
        try {
          matched = new RegExp(regexLiteral.body, regexLiteral.flags || 'i').test(String(key || '').toLowerCase());
        } catch {
          matched = false;
        }
      } else {
        matched = String(key || '').toLowerCase() === normalizedValue.toLowerCase();
      }
      return negate ? !matched : matched;
    };

    const domainPatternMatchesUrl = (pattern, inputUrl) => {
      const rawPattern = String(pattern || '').trim();
      if (!rawPattern) return false;
      if (rawPattern === '*') return true;

      const regexLiteral = parseRegexLiteral(rawPattern);
      if (regexLiteral) {
        try {
          return new RegExp(regexLiteral.body, regexLiteral.flags).test(inputUrl);
        } catch {
          return false;
        }
      }

      let urlObj;
      try {
        urlObj = new URL(inputUrl);
      } catch {
        return false;
      }

      if (rawPattern.startsWith('||')) {
        const body = rawPattern.slice(2);
        const boundaryIndex = body.search(/[\^/?#]/);
        const hostPattern = (boundaryIndex === -1 ? body : body.slice(0, boundaryIndex)).replace(/^\*\./, '');
        const tail = boundaryIndex === -1 ? '' : body.slice(boundaryIndex).replace(/^\^/, '');
        const hostRegex = '^(.+\\.)?' + hostPattern
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\*/g, '[^.]+') + '$';
        if (!new RegExp(hostRegex, 'i').test(urlObj.hostname)) return false;
        if (!tail) return true;
        return (urlObj.pathname + urlObj.search + urlObj.hash).toLowerCase().startsWith(tail.toLowerCase());
      }

      return inputUrl.toLowerCase().includes(rawPattern.toLowerCase());
    };

    const providerMatchesUrl = (provider, inputUrl) => {
      if (typeof provider.urlPattern === 'string' && provider.urlPattern.trim()) {
        try {
          return new RegExp(provider.urlPattern, 'i').test(inputUrl);
        } catch {
          return false;
        }
      }

      if (Array.isArray(provider.domainPatterns)) {
        return provider.domainPatterns.some(pattern => domainPatternMatchesUrl(pattern, inputUrl));
      }

      return false;
    };

    // ── 4. Per-provider validation ────────────────────────────────────────────
    // One grammar for every rule (docs/rule-syntax.md), checked by the same
    // module the extension uses (core_js/rule_syntax.js).
    this.info('🔎 Validating provider patterns & rules...');

    const syntax = this.getRuleSyntax();
    let legacyProviders = 0;
    for (const [name, provider] of providerEntries) {
      if (!syntax.isCanonicalProvider(provider)) {
        legacyProviders++;
        continue;
      }
      totalRulesChecked += Array.isArray(provider.rules) ? provider.rules.length : 0;
      errors.push(...syntax.validateProvider(provider, name));
    }
    if (legacyProviders > 0) {
      errors.push(`${legacyProviders} provider(s) use the older multi-section format — convert with: node scripts/convert-rule-syntax.js ${rulesFile}`);
    }
    // The smoke tests below run on the compiled (engine-internal) form.
    const runtimeEntries = providerEntries.map(([name, provider]) => [name, syntax.prepareProvider(provider, name)]);

    // ── 5. Functional smoke tests ─────────────────────────────────────────────
    // Mirrors clearurls.js removeFieldsFormURL.
    // Finds ALL providers whose match patterns match the test URL and applies
    // their rules — works for any file regardless of provider naming.
    this.info('🧪 Running functional smoke tests...');

    // Apply every matching provider's rules to a URL string
    const applyAllMatchingProviders = (inputUrl) => {
      let urlStr = inputUrl;
      for (const [, provider] of runtimeEntries) {
        if (!providerMatchesUrl(provider, urlStr)) continue;

        // rawRules (full-string replace)
        for (const rawRule of (Array.isArray(provider.rawRules) ? provider.rawRules : [])) {
          const rawPattern = getRulePattern(rawRule);
          const rawFlags = rawRule && typeof rawRule.flags === 'string' ? rawRule.flags : 'gi';
          try { if (rawPattern) urlStr = urlStr.replace(new RegExp(rawPattern, rawFlags), ''); } catch { /* bad regex already reported */ }
        }

        // rules + referralMarketing (query-param name matching)
        let urlObj;
        try { urlObj = new URL(urlStr); } catch { continue; }
        const params = urlObj.searchParams;
        const allRules = [
          ...(Array.isArray(provider.rules) ? provider.rules : []),
          ...(Array.isArray(provider.referralMarketing) ? provider.referralMarketing : [])
        ];
        for (const rule of allRules) {
          const rulePattern = getRulePattern(rule);
          if (!rulePattern) continue;
          // @@ exceptions keep parameters; they never remove anything.
          if (rulePattern.trim().startsWith('@@')) continue;
          const toDelete = [];
          for (const key of params.keys()) {
            // Fresh RegExp each time — avoids stateful lastIndex with 'g' flag
            if (isRemoveParamRule(rule)) {
              if (removeParamRuleMatchesKey(rule, key)) toDelete.push(key);
            } else if (new RegExp(`^${rulePattern}$`, 'gi').test(key)) {
              toDelete.push(key);
            }
          }
          for (const key of toDelete) params.delete(key);
        }
        urlObj.search = params.toString() ? `?${params.toString()}` : '';
        urlStr = urlObj.toString();
      }
      return urlStr;
    };

    const smokeTests = [
      {
        label: 'Amazon — removes qid, pd_rd_r, tag; keeps keepme',
        url: 'https://www.amazon.com/dp/B09V3KXJPB?tag=ref-20&pd_rd_r=abc&qid=1234&keepme=1',
        expectAbsent:  ['tag', 'pd_rd_r', 'qid'],
        expectPresent: ['keepme']
      },
      {
        label: 'Global UTM — removes utm_source, utm_medium, fbclid; keeps keepme',
        url: 'https://example.com/page?utm_source=nl&utm_medium=email&fbclid=x&keepme=1',
        expectAbsent:  ['utm_source', 'utm_medium', 'fbclid'],
        expectPresent: ['keepme']
      },
      {
        label: 'Google — removes ved, ei, source; keeps q, keepme',
        url: 'https://www.google.com/search?q=hello&ved=abc&ei=xyz&source=web&keepme=1',
        expectAbsent:  ['ved', 'ei', 'source'],
        expectPresent: ['q', 'keepme']
      },
      {
        label: 'YouTube — removes si, feature; keeps v, keepme',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc&feature=share&keepme=1',
        expectAbsent:  ['si', 'feature'],
        expectPresent: ['v', 'keepme']
      },
      {
        label: 'Facebook — removes hc_ref; keeps fbid, keepme',
        url: 'https://www.facebook.com/photo?fbid=123&hc_ref=ARSxyz&keepme=1',
        expectAbsent:  ['hc_ref'],
        expectPresent: ['fbid', 'keepme']
      }
    ];

    let smokePass = 0;
    let smokeFail = 0;
    let smokeSkip = 0;

    for (const test of smokeTests) {
      try {
        const originalObj = new URL(test.url);
        const cleaned     = applyAllMatchingProviders(test.url);
        const cleanedObj  = new URL(cleaned);
        const cleanParams = cleanedObj.searchParams;

        const stillPresent   = test.expectAbsent.filter(p => cleanParams.has(p));
        const wronglyRemoved = (test.expectPresent || []).filter(p =>
          originalObj.searchParams.has(p) && !cleanParams.has(p)
        );
        const anyRemoved     = test.expectAbsent.some(p => !cleanParams.has(p));

        if (!anyRemoved) {
          // Zero params cleaned → no matching rules in this file for these params → skip
          this.log(`  ⏭️  ${test.label} (skipped — no rules for these params in this file)`, 'dim');
          smokeSkip++;
          continue;
        }

        if (wronglyRemoved.length > 0) {
          // Over-removal is always a real problem (a rule is too greedy)
          let msg = `  ⚠️  ${test.label}`;
          msg += `\n       Over-removed (should stay): ${wronglyRemoved.join(', ')}`;
          if (stillPresent.length) msg += `\n       Also not removed     : ${stillPresent.join(', ')}`;
          this.warning(msg);
          warnings.push(`Smoke test [${test.label}]: over-removed=[${wronglyRemoved.join(',')}]`);
          smokeFail++;
        } else if (stillPresent.length === 0) {
          // All expected params removed, nothing over-removed → full pass
          this.success(`  ✅ ${test.label}`);
          smokePass++;
        } else {
          // Some params removed, some not → partial coverage, informational only
          this.info(`  ℹ️  ${test.label} — partial (not in this file): ${stillPresent.join(', ')}`);
          smokePass++;
        }
      } catch (e) {
        this.error(`  ❌ ${test.label}: ${e.message}`);
        errors.push(`Smoke test error [${test.label}]: ${e.message}`);
        smokeFail++;
      }
    }

    // ── 6. Summary ────────────────────────────────────────────────────────────
    this.section('📊 Lint Summary');
    this.info(`  File        : ${rulesFile}`);
    this.info(`  Format      : ${formatLabel}`);
    this.info(`  Providers   : ${providerEntries.length}`);
    this.info(`  Rules checked: ${totalRulesChecked}`);
    this.info(`  Smoke tests : ${smokePass} passed, ${smokeFail} failed, ${smokeSkip} skipped`);
    this.info(`  Errors      : ${errors.length}`);
    this.info(`  Warnings    : ${warnings.length}`);

    if (errors.length > 0) {
      this.log('');
      this.error(`❌ ${errors.length} error(s):`);
      for (const e of errors) this.error(`   • ${e}`);
    }

    if (warnings.length > 0) {
      this.log('');
      this.warning(`⚠️  ${warnings.length} warning(s):`);
      for (const w of warnings) this.warning(`   • ${w}`);
    }

    this.log('');
    if (errors.length === 0) {
      this.success(`✅ Lint passed — ${providerEntries.length} providers, 0 errors, ${warnings.length} warning(s)`);
      return true;
    } else {
      this.error(`❌ Lint FAILED — ${errors.length} error(s) must be fixed`);
      return false;
    }
  }

  // NEW: Create or append to NOTICE.md file (from superior script)
  createNoticeFile(outputFiles, stats, version) {
    const noticeFile = config.noticeFile;
    const sourceFile = stats.sourceFile || this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile;
    const bundledFile = stats.outputFile || this.clearurlsConfig.compressedRulesFile;
    const describeOutputFile = (file) => {
      if (file === sourceFile || file.endsWith('.json')) {
        return 'Canonical metadata-free ClearURLs source JSON';
      }
      if (file.endsWith('.lz4')) {
        return `LZ4-compressed bundle generated from ${sourceFile} with Linkumori metadata v${version} injected`;
      }
      return `Generated ClearURLs artifact v${version}`;
    };

    const currentBuildInfo = `
---

## Build Information - ${version}

**Build Date**: ${new Date().toISOString()}
**Version**: ${version}
**Source File**: ${sourceFile}
**Bundled LZ4 Output**: ${bundledFile}

### Build Statistics

- **Source providers**: ${stats.sourceProviderCount}

### Generated Files

${outputFiles.map(file => `- \`${file}\` - ${describeOutputFile(file)}`).join('\n')}

### Build Summary

This build used ${sourceFile} as the canonical metadata-free ClearURLs source JSON, injected Linkumori metadata only into the generated rules payload, and compressed that payload into ${bundledFile}.

### Provenance Notice

${sourceFile} carries forward the historical rule-source modifications from deprecated data/custom-rules.json, data/downloaded-official-rules.json, and the earlier data/linkumori-clearurls-min.json.lz4 bundle. Sidecar notices are preserved at data/linkumori-clearurls.json.txt, data/linkumori-clearurls-min.json.lz4.txt, data/custom-rules.json.txt, and data/downloaded-official-rules.json.txt.

*Generated by  Linkumori CLI Tool  v${version}*
`;

    if (fs.existsSync(noticeFile)) {
      this.info(`📋 Appending to existing notice file: ${noticeFile}`);
      
      // Read existing content
      const existingContent = fs.readFileSync(noticeFile, 'utf8');
      
      // Check if this is the first build entry being added
      const separator = existingContent.includes('## Build Information -') 
        ? currentBuildInfo 
        : `\n## Build History\n\nThis section contains information about all builds performed with this script.\n${currentBuildInfo}`;
      
      // Append new build info
      const updatedContent = existingContent + separator;
      fs.writeFileSync(noticeFile, updatedContent);
      
    } else {
      this.info(`📋 Creating new notice file: ${noticeFile}`);
      
      // Create complete notice file for first time
      const completeNoticeContent = `# Linkumori ClearURLs Rules Builder - NOTICE

## About This Build

This directory contains the canonical metadata-free Linkumori ClearURLs source JSON and the compressed rules bundle generated from it.

### What This Script Does

The Linkumori ClearURLs Rules Builder performs the following operations:

1. **Loads Source Rules**: Reads canonical URL cleaning rules from ${sourceFile}
2. **Normalizes Source JSON**: Keeps the wrapped ClearURLsData shape with providers, without writing metadata to the source file
3. **Generates Output**: Injects Linkumori metadata into the generated payload and compresses it into ${bundledFile}
4. **Validation**: Ensures rules have proper structure and compile before bundling

### Versioning System

This build uses automatic date-time based versioning:
- **Format**: dd.mm.yyyy.HHMM
- **Current Version**: ${version}
- **Example**: 31.07.2025.1430 (July 31, 2025 at 14:30)

This ensures each build has a unique version identifier based on when it was created.

### Linkumori Project

This enhanced version includes metadata for the Linkumori URL cleaning project:
- **Repository**: https://github.com/Linkumori/Linkumori-Addon
- **Homepage**: https://addons.mozilla.org/en-US/firefox/addon/linkumori-clean-urls/
- **Issues**: https://github.com/Linkumori/Linkumori-Addon/issues
- **This script written by subham mahesh in 2026 some significated part taken from cleaurls Kevin Röbert which is licensed under LGPL 3.0**
- **linkumori-clearurls.json** is the canonical metadata-free source rules file; it carries forward historical modifications and provenance from the deprecated data/custom-rules.json, data/downloaded-official-rules.json, and earlier data/linkumori-clearurls-min.json.lz4 bundle.
- **Copyright**: Linkumori modifications and curated additions are Copyright (c) 2025-2026 Subham Mahesh. ClearURLs Rules portions remain copyright their respective ClearURLs authors and contributors, including Kevin Röbert where applicable.
- **Sidecar notices**: data/linkumori-clearurls.json.txt, data/linkumori-clearurls-min.json.lz4.txt, data/custom-rules.json.txt, and data/downloaded-official-rules.json.txt.
- **Final output generated by script**: ${bundledFile}

### License Information

**All files in this directory are licensed under LGPL 3.0:**

- **Source file** (${sourceFile}), **output file** (${bundledFile}), and historical source notices: Licensed under LGPL 3.0-or-later
- **This script**: Licensed under LGPL 3.0

### Historical Rule Source Notices

The deprecated data/custom-rules.json, data/downloaded-official-rules.json, and prior generated LZ4 bundle have been consolidated into ${sourceFile}. Their modification notices are intentionally preserved as sidecar files so ${sourceFile} carries all old rule-source modification history forward.

#### LGPL 3.0 License Summary

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along with this program. If not, see <http://www.gnu.org/licenses/>.

### ClearURLs Project

The official ClearURLs project and rules are maintained at:
- GitHub: https://github.com/ClearURLs/Rules
- Extension: https://github.com/ClearURLs/Addon

### Usage

These generated files can be used with ClearURLs browser extensions or any compatible URL cleaning tool that supports the ClearURLs rule format.

## Build History

This section contains information about all builds performed with this script.
${currentBuildInfo}`;

      fs.writeFileSync(noticeFile, completeNoticeContent);
    }
    
    this.success(`📋 NOTICE.md ${fs.existsSync(noticeFile) ? 'updated' : 'created'}`);
  }

  // Build bundled ClearURLs rules from the canonical source JSON.
  async buildCustomClearURLs(options = {}) {
    this.section('🧹 Building ClearURLs LZ4 Bundle');
    
    const {
      sourceFile = this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile,
      outputFile = this.clearurlsConfig.compressedRulesFile
    } = options;

    try {
      // Ensure data directory exists
      try {
        fs.mkdirSync('data', { recursive: true });
      } catch {
        // Directory already exists
      }

      const sourceRules = this.loadClearURLsSourceRules(sourceFile);
      if (sourceRules === null) {
        return false;
      }

      const providerCount = Object.keys(sourceRules.providers || {}).length;
      if (providerCount === 0) {
        this.error(`No rules to process in ${sourceFile}.`);
        return false;
      }

      this.info(`📊 Source providers: ${providerCount}`);

      const minifiedRules = this.minifyRules(sourceRules);
      delete minifiedRules.metadata;
      const sourceOutputContent = this.formatMinifiedOutput(minifiedRules, { includeMetadata: false });
      fs.writeFileSync(sourceFile, sourceOutputContent);
      this.success(`📄 Metadata-free source rules normalized: ${sourceFile}`);

      const linkumoriRules = this.createLinkumoriJSON(minifiedRules);
      const lz4PayloadContent = this.formatMinifiedOutput(linkumoriRules, { includeMetadata: true });
      const lz4Stats = this.writeLZ4CompressedContent(lz4PayloadContent, outputFile);
      this.success(`🗜️ LZ4 rules saved to: ${lz4Stats.outputFile}`);

      const stats = {
        sourceProviderCount: Object.keys(linkumoriRules.providers || {}).length,
        sourceFile,
        outputFile: lz4Stats.outputFile
      };
      
      const outputFiles = [sourceFile, lz4Stats.outputFile];
      const generatedVersion = linkumoriRules.metadata.version;
      this.createNoticeFile(outputFiles, stats, generatedVersion);

      const sourceStats = fs.statSync(sourceFile);

      this.section('🎉 Build Summary');
      this.success(`📅 Version: ${generatedVersion}`);
      this.info(`📂 Source file: ${sourceFile}`);
      this.info(`📊 Providers: ${stats.sourceProviderCount}`);
      this.info(`🔖 Metadata: Linkumori metadata v${generatedVersion} injected into LZ4 only`);
      this.info(`📁 Source JSON: ${Math.round(sourceStats.size / 1024)}KB`);
      this.info(`🗜️ LZ4 file: ${Math.round(lz4Stats.outputSize / 1024)}KB (${((1 - lz4Stats.ratio) * 100).toFixed(1)}% smaller)`);
      this.info(`📋 Documentation: ${config.noticeFile}`);
      
      return true;
    } catch (error) {
      this.error(`Error building rules: ${error.message}`);
      return false;
    }
  }

  // Validate project structure
  async validateProject() {
    this.section('Validating Project Structure');
    
    let isValid = true;
    
    // Check manifest.json
    try {
      const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
      this.success('manifest.json found and valid');
      this.info(`  Extension: ${manifest.name || 'Unknown'}`);
      this.info(`  Version: ${manifest.version || 'Unknown'}`);
    } catch {
      this.error('manifest.json not found or invalid');
      isValid = false;
    }
    
    // Check Old Country Nobility directory
    try {
      const stat = fs.statSync(config.oldCountryNobilityDir);
      if (stat.isDirectory()) {
        this.success(`Old Country Nobility directory found: ${config.oldCountryNobilityDir}`);
        
        try {
          fs.statSync(`${config.oldCountryNobilityDir}/Old-Country-Nobility.sfd`);
          this.success('Old Country Nobility .sfd file found');
        } catch {
          this.warning('Old Country Nobility .sfd file not found');
        }
      }
    } catch {
      this.warning(`Old Country Nobility directory not found: ${config.oldCountryNobilityDir}`);
    }
    
    return isValid;
  }

  // Build Old Country Nobility font from .sfd to .ttf using fontforge
  async buildOldCountryNobilityFont() {
    this.section('Building Old Country Nobility Font');
    
    const sfdFile = './Old-Country-Nobility/Old-Country-Nobility.sfd';
    const ttfFile = './Old-Country-Nobility/Old-Country-Nobility.ttf';
    
    // Check if .sfd file exists
    try {
      fs.statSync(sfdFile);
    } catch {
      this.error(`Old Country Nobility .sfd file not found: ${sfdFile}`);
      return false;
    }
    
    // Check dependencies
    const fontforge = await this.exec('which', ['fontforge']);
    if (!fontforge.success) {
      this.error('fontforge not found. Install with:');
      this.info('  Ubuntu/Debian: sudo apt-get install fontforge python3-fontforge');
      this.info('  macOS: brew install fontforge');
      this.info('  Fedora: sudo dnf install fontforge python3');
      return false;
    }
    
    this.info(`Converting ${sfdFile} to ${ttfFile}...`);
    
    // Create fontforge script to convert .sfd to .ttf
    const fontforgeScript = `
Open("${sfdFile}")
Generate("${ttfFile}")
Quit()
`;
    
    const scriptFile = './temp-fontforge-script.pe';
    
    try {
      // Write temporary fontforge script
      fs.writeFileSync(scriptFile, fontforgeScript);
      
      // Execute fontforge with the script
      const buildResult = await this.exec('fontforge', ['-script', scriptFile], { showOutput: true });
      
      // Clean up temporary script
      fs.unlinkSync(scriptFile);
      
      if (!buildResult.success) {
        this.error('Old Country Nobility font build failed');
        this.error(buildResult.error);
        return false;
      }
      
      // Verify the output file was created
      try {
        const stat = fs.statSync(ttfFile);
        const sizeKB = Math.round(stat.size / 1024);
        this.success(`Old Country Nobility font built: ${ttfFile} (${sizeKB}KB)`);
        return true;
      } catch {
        this.error(`Failed to create ${ttfFile}`);
        return false;
      }
    } catch (error) {
      // Clean up temporary script if it exists
      try {
        fs.unlinkSync(scriptFile);
      } catch {
        // Ignore cleanup errors
      }
      this.error(`Failed to build Old Country Nobility font: ${error.message}`);
      return false;
    }
  }

  async hasRsvgConvert() {
    const check = await this.exec('which', ['rsvg-convert']);
    return check.success;
  }

  async renderSvgToPng(svgPath, outputPath, size) {
    return await this.exec('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', outputPath, svgPath]);
  }

  // Generate extension icons from SVG source assets
  async generateIcons() {
    this.section('Generating Icon PNG Files');

    const mainSvg = 'img/linkumori_icons.svg';
    const disabledSvg = 'img/linkumori_icon_disabled.svg';
    const sizes = [16, 19, 20, 24, 30, 32, 38, 48, 64, 96, 128];
    const generatedFiles = [];

    try {
      fs.statSync(mainSvg);
    } catch {
      this.error(`Main icon source not found: ${mainSvg}`);
      return false;
    }

    try {
      fs.statSync(disabledSvg);
    } catch {
      this.error(`Disabled icon source not found: ${disabledSvg}`);
      return false;
    }

    if (!(await this.hasRsvgConvert())) {
      this.error('rsvg-convert not found. Icon generation requires librsvg.');
      this.info('macOS: brew install librsvg');
      this.info('Ubuntu/Debian: sudo apt-get install librsvg2-bin');
      this.info('Fedora: sudo dnf install librsvg2-tools');
      return false;
    }

    this.info('Using icon rasterizer: rsvg-convert');

    for (const size of sizes) {
      const outputPath = `img/icon${size}.png`;
      const result = await this.renderSvgToPng(mainSvg, outputPath, size);
      if (!result.success) {
        this.error(`Failed generating ${outputPath}`);
        if (result.error) this.log(result.error, 'red');
        return false;
      }
      generatedFiles.push(outputPath);
    }

    const grayOutput = 'img/icon128_gray.png';
    const grayResult = await this.renderSvgToPng(disabledSvg, grayOutput, 128);
    if (!grayResult.success) {
      this.error(`Failed generating ${grayOutput}`);
      if (grayResult.error) this.log(grayResult.error, 'red');
      return false;
    }
    generatedFiles.push(grayOutput);

    for (const file of generatedFiles) {
      try {
        const stat = fs.statSync(file);
        if (stat.size <= 0) {
          this.error(`Generated icon is empty: ${file}`);
          return false;
        }
      } catch {
        this.error(`Generated icon missing after render: ${file}`);
        return false;
      }
    }

    this.success(`Generated ${generatedFiles.length} icon files from SVG sources`);
    return true;
  }

  // Build ignore patterns
  getIgnorePatterns() {
    const normalizeIgnorePath = (pattern) => pattern.replace(/\\/g, '/').replace(/^\.\//, '');
    const requiredIgnorePatterns = [
      normalizeIgnorePath(config.urlConfigFile),
      normalizeIgnorePath(config.regressionSuiteFile)
    ];

    // Always resolve relative to the script file so CI runners that change
    // the working directory before invoking this script still find the file.
    const buildIgnorePath = path.resolve(SCRIPT_DIR, config.buildIgnoreFile);
    if (isCI) {
      this.info(`[CI] Loading ignore patterns from: ${buildIgnorePath}`);
    }

    try {
      const content = fs.readFileSync(buildIgnorePath, 'utf8');
      const patterns = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      // Add automatic empty directory patterns
      const expandedPatterns = [];
      for (const pattern of patterns) {
        expandedPatterns.push(pattern);
        if (pattern.endsWith('/**')) {
          const dirPattern = pattern.slice(0, -3);
          expandedPatterns.push(dirPattern);
        }
      }

      const normalizedPatterns = expandedPatterns.map(normalizeIgnorePath);
      for (const requiredPattern of requiredIgnorePatterns) {
        if (!normalizedPatterns.includes(requiredPattern)) {
          expandedPatterns.push(requiredPattern);
        }
      }

      if (isCI) {
        this.info(`[CI] Applying ${expandedPatterns.length} ignore pattern(s) to web-ext`);
      }
      return expandedPatterns;
    } catch (err) {
      this.warning(`No .build-ignore file found at ${buildIgnorePath}, using defaults`);
      if (isCI) {
        this.warning(`[CI] ${err.message}`);
      }
      return requiredIgnorePatterns;
    }
  }

  // Build extension
  async buildExtension(pslMode = 'auto') {
    this.header('Building Linkumori Extension');

    this.info('Step 0/6: Preparing Public Suffix List...');
    if (!(await this.ensurePslReady(pslMode))) {
      this.error('PSL preparation failed, aborting build.');
      return false;
    }
    
    // 1. Generate copyright documentation with embedded licenses
    this.info('Step 1/6: Generating copyright documentation...');
    await this.generateCopyrightDocumentation();
    
    // 2. Run custom clearurls builder (with enhanced logic)
    this.info('Step 2/6: Building ClearURLs rules...');
    if (!(await this.buildCustomClearURLs())) {
      this.warning('Custom ClearURLs build failed, continuing without it...');
    }
    
    // 3. Build Old Country Nobility Font
    this.info('Step 3/6: Building Old Country Nobility Font...');
    if (!(await this.buildOldCountryNobilityFont())) {
      this.warning('Old Country Nobility font build failed, continuing without it...');
    }
    
    // 4. Validate project
    this.info('Step 4/6: Generating icon assets...');
    if (!(await this.generateIcons())) {
      this.error('Icon generation failed, aborting build.');
      return false;
    }

    // 5. Validate project
    this.info('Step 5/6: Validating project structure...');
    if (!(await this.validateProject())) {
      return false;
    }
    
    // 5. Clean previous builds
    try {
      fs.rmSync(config.buildDir, { recursive: true, force: true });
      this.info('Cleaned previous build artifacts');
    } catch {
      // Directory doesn't exist, that's fine
    }
    
    // 6. Build with web-ext
    this.info('Step 6/6: Building extension package...');
    this.section('Building Extension Package');
    const ignorePatterns = this.getIgnorePatterns();
    
    const buildArgs = [
      'build',
      '--artifacts-dir=' + config.buildDir,
      '--overwrite-dest',
      '--source-dir=' + config.sourceDir,
      '--no-config-discovery'
    ];

    if (ignorePatterns.length > 0) {
      buildArgs.push('--ignore-files');
      buildArgs.push(...ignorePatterns);
    }

    const buildResult = await this.exec('web-ext', buildArgs);
    
    if (!buildResult.success) {
      this.error('Extension build failed');
      this.log(buildResult.error, 'red');
      return false;
    }
    
    // Convert .zip to .xpi
    try {
      const entries = fs.readdirSync(config.buildDir);
      for (const entry of entries) {
        if (entry.endsWith('.zip')) {
          const oldPath = `${config.buildDir}/${entry}`;
          const newPath = `${config.buildDir}/${entry.replace('.zip', '.xpi')}`;
          fs.renameSync(oldPath, newPath);
          this.success(`Converted: ${entry} → ${entry.replace('.zip', '.xpi')}`);
        }
      }
    } catch (error) {
      this.warning(`Error converting files: ${error.message}`);
    }
    
    this.success('Extension build completed successfully!');
    this.showBuildResults();
    return true;
  }

  // Sign extension
  async signExtension() {
    this.section('Signing Extension');
    
    const apiKey = this.env.WEB_EXT_API_KEY || process.env.WEB_EXT_API_KEY;
    const apiSecret = this.env.WEB_EXT_API_SECRET || process.env.WEB_EXT_API_SECRET;
    const channel = this.env.WEB_EXT_CHANNEL || process.env.WEB_EXT_CHANNEL;
    
    if (!apiKey || !apiSecret || !channel) {
      this.error('Missing signing credentials:');
      if (!apiKey) this.error('  WEB_EXT_API_KEY not set');
      if (!apiSecret) this.error('  WEB_EXT_API_SECRET not set');
      if (!channel) this.error('  WEB_EXT_CHANNEL not set (use "listed" or "unlisted")');
      this.info('Get credentials from: https://addons.mozilla.org/developers/addon/api/key/');
      return false;
    }
    
    // Convert .xpi back to .zip for signing
    try {
      const entries = fs.readdirSync(config.buildDir);
      for (const entry of entries) {
        if (entry.endsWith('.xpi')) {
          const oldPath = `${config.buildDir}/${entry}`;
          const newPath = `${config.buildDir}/${entry.replace('.xpi', '.zip')}`;
          fs.renameSync(oldPath, newPath);
          this.info(`Prepared for signing: ${entry} → ${entry.replace('.xpi', '.zip')}`);
        }
      }
    } catch {
      // No existing files to convert
    }
    
    const signArgs = [
      'sign',
      '--artifacts-dir=' + config.buildDir,
      '--source-dir=' + config.sourceDir,
      '--api-key=' + apiKey,
      '--api-secret=' + apiSecret,
      '--channel=' + channel,
      '--approval-timeout=' + (channel === 'listed' ? '0' : (this.env.WEB_EXT_APPROVAL_TIMEOUT || '900000')),
      '--no-config-discovery'
    ];

    const ignorePatterns = this.getIgnorePatterns();
    if (ignorePatterns.length > 0) {
      signArgs.push('--ignore-files');
      signArgs.push(...ignorePatterns);
    }
    
    this.info(`Signing with channel: ${channel}`);
    const signResult = await this.exec('web-ext', signArgs);
    
    if (signResult.success) {
      if (channel === 'listed') {
        this.success('Extension submitted to AMO for listed distribution');
        this.info('Check your AMO developer dashboard for approval status');
        this.info('Exiting CLI — sign request has been sent to AMO.');
        process.exit(0);
      } else {
        this.success('Extension signed for unlisted distribution');
        this.showBuildResults();
      }
      return true;
    } else {
      this.error('Signing failed');
      this.log(signResult.error, 'red');
      return false;
    }
  }

  // Show build results
  showBuildResults() {
    try {
      this.section('Build Results');
      const entries = fs.readdirSync(config.buildDir);
      
      for (const entry of entries) {
        const stat = fs.statSync(`${config.buildDir}/${entry}`);
        const sizeKB = Math.round(stat.size / 1024);
        this.success(`${entry} (${sizeKB}KB)`);
      }
    } catch {
      this.warning('No build artifacts found');
    }
  }

  // Create environment template
  createEnvTemplate() {
    const template = `# Linkumori Addon (Firefox) - Mozilla Add-ons API Credentials
# Get these from: https://addons.mozilla.org/developers/addon/api/key/

# Required for signing Linkumori extension
WEB_EXT_API_KEY=user:12345:67
WEB_EXT_API_SECRET=your-long-api-secret-string-here

# Required signing channel - choose one:
WEB_EXT_CHANNEL=unlisted

# Optional signing configuration
# WEB_EXT_APPROVAL_TIMEOUT=900000
# WEB_EXT_AMO_BASE_URL=https://addons.mozilla.org/api/v5/
# WEB_EXT_API_PROXY=https://your-proxy:6000

# Channel options:
#   unlisted - Downloads signed .xpi for self-distribution
#   listed   - Submits to AMO store, requires approval
`;

    try {
      fs.writeFileSync('.env.template', template);
      this.success('Created .env.template');
      this.info('Next steps:');
      this.info('1. Use option "Convert .env.template to .env" in menu');
      this.info('2. Edit .env with your Mozilla API credentials');
      this.info('3. Choose your preferred WEB_EXT_CHANNEL');
    } catch (error) {
      this.error(`Failed to create .env.template: ${error.message}`);
    }
  }

  // Convert .env.template to .env
  convertEnvTemplate() {
    this.section('Converting .env.template to .env');
    
    // Check if .env.template exists
    try {
      fs.statSync('.env.template');
    } catch {
      this.error('.env.template not found');
      this.info('Create template first with setup option');
      return false;
    }
    
    // Check if .env already exists
    try {
      fs.statSync('.env');
      this.warning('.env file already exists');
      if (this.isInteractive()) {
        const overwrite = prompt('Overwrite existing .env? (y/N): ');
        if (overwrite?.toLowerCase() !== 'y') {
          this.info('Cancelled - existing .env preserved');
          return false;
        }
      } else {
        this.info('Non-interactive mode: skipping .env overwrite');
        return false;
      }
    } catch {
      // .env doesn't exist, which is what we want
    }
    
    try {
      const templateContent = fs.readFileSync('.env.template', 'utf8');
      fs.writeFileSync('.env', templateContent);
      this.success('Successfully converted .env.template to .env');
      this.info('Next steps:');
      this.info('1. Edit .env with your actual Mozilla API credentials');
      this.info('2. Set your preferred WEB_EXT_CHANNEL (listed or unlisted)');
      this.info('3. Test credentials with status option');
      return true;
    } catch (error) {
      this.error(`Failed to convert template: ${error.message}`);
      return false;
    }
  }

  // Create build ignore template
  createBuildIgnore() {
    const template = `# Linkumori Extension Build Ignore File
# Files and directories to ignore during web-ext operations

# Development files
*.log
*.tmp
.DS_Store
Thumbs.db

# Dependencies
node_modules/**
npm-debug.log*
package-lock.json
package.json

# Version Control
.git/**
.svn/**

# IDEs
.vscode/**
.idea/**
*.swp
*~

# Build Output
web-ext-artifacts/**
build/**
dist/**
CHANGELOG.md
docs/**
# Assets & Fonts (sources only, keep compiled)
svg/**
Old-Country-Nobility/Old-Country-Nobility.sfd

# Data Files (keep bundled LZ4, exclude source/config)
data/linkumori-clearurls.json
data/url-config.json
# Build Tools
.build-ignore
linkumori-cli-tool.js
scripts/**
Template.md
COMMIT_HISTORY.md

# Environment
.env
.env.local

# Testing
test/**
tests/**
tests/regression-suite.json
coverage/**
`;

    try {
      fs.writeFileSync(config.buildIgnoreFile, template);
      this.success('Created .build-ignore template');
    } catch (error) {
      this.error(`Failed to create .build-ignore: ${error.message}`);
    }
  }

  // Create canonical ClearURLs source template
  createCustomRulesTemplate() {
    const template = {
      "providers": {
        "example": {
          "match": [
            "||example.com^"
          ],
          "rules": [
            "$removeparam=tracking_param",
            "$removeparam=/^utm_/i",
            "$removeparam=ref,referral",
            "@@||example.com^/checkout"
          ]
        }
      }
    };
  
    try {
      fs.mkdirSync('data', { recursive: true });
      const templatePath = this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile;
      fs.writeFileSync(templatePath, this.formatMinifiedOutput(template, { includeMetadata: false }));
      this.success(`Created ClearURLs source template: ${templatePath}`);
      this.info('Edit this source JSON with your bundled URL cleaning rules');
    } catch (error) {
      this.error(`Failed to create template: ${error.message}`);
    }
  }

  // Show status
  showStatus() {
    this.header('Linkumori Extension Status');
    
    // Project status
    this.section('Project Structure');
    try {
      const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
      this.success(`Extension: ${manifest.name} v${manifest.version}`);
    } catch {
      this.error('manifest.json missing or invalid');
    }
    
    try {
      const entries = fs.readdirSync(config.buildDir);
      this.success(`Build artifacts: ${entries.length} files`);
    } catch {
      this.warning('No build artifacts found');
    }
    
    // Environment status
    this.section('Environment Configuration');
    const apiKey = this.env.WEB_EXT_API_KEY || process.env.WEB_EXT_API_KEY;
    const apiSecret = this.env.WEB_EXT_API_SECRET || process.env.WEB_EXT_API_SECRET;
    const channel = this.env.WEB_EXT_CHANNEL || process.env.WEB_EXT_CHANNEL;
    
    if (apiKey) {
      this.success(`API Key: ${apiKey}`);
    } else {
      this.error('API Key: not set');
    }
    
    if (apiSecret) {
      this.success(`API Secret: set (${apiSecret.length} characters)`);
    } else {
      this.error('API Secret: not set');
    }
    
    if (channel) {
      this.success(`Channel: ${channel}`);
    } else {
      this.error('Channel: not set');
    }
    
    // Copyright Documentation status
    this.section('Copyright Documentation Status');
    try {
      fs.statSync(config.licenseTemplateFile);
      this.success(`Copyright template found: ${config.licenseTemplateFile}`);
    } catch {
      this.warning(`Copyright template not found: ${config.licenseTemplateFile}`);
    }
    
    // Check licenses directory
    try {
      fs.statSync('licenses');
      this.success('licenses/ directory exists');
      
      // Check for individual license files
      const licenseFiles = Object.values(this.licenseConfig.sources);
      let foundCount = 0;
      let missingCount = 0;
      
      for (const filePath of licenseFiles) {
        try {
          const stat = fs.statSync(filePath);
          const sizeKB = Math.round(stat.size / 1024);
          this.success(`  ${filePath} (${sizeKB}KB)`);
          foundCount++;
        } catch {
          this.warning(`  ${filePath} - NOT FOUND`);
          missingCount++;
        }
      }
      
      if (missingCount > 0) {
        this.warning(`${missingCount} license file(s) missing - see licenses/README.md for download instructions`);
      }
    } catch {
      this.error('licenses/ directory not found');
      this.info('Run setup to create the licenses directory structure');
    }
    
    const outputPath = config.licenseOutputDir 
      ? `${config.licenseOutputDir}/${config.licenseOutputFile}`
      : config.licenseOutputFile;
    
    try {
      const stat = fs.statSync(outputPath);
      const sizeKB = Math.round(stat.size / 1024);
      this.success(`Generated copyright doc: ${outputPath} (${sizeKB}KB)`);
    } catch {
      this.warning('Generated copyright documentation not found (run build to generate)');
    }
    
    // Old Country Nobility Font status
    this.section('Old Country Nobility Font Status');
    try {
      const stat = fs.statSync(`${config.oldCountryNobilityDir}/Old-Country-Nobility.ttf`);
      const sizeKB = Math.round(stat.size / 1024);
      this.success(`Old-Country-Nobility.ttf available (${sizeKB}KB)`);
    } catch {
      this.warning('Old-Country-Nobility.ttf not found (run build to generate)');
    }
    
    try {
      fs.statSync(`${config.oldCountryNobilityDir}/Old-Country-Nobility.sfd`);
      this.success('Old-Country-Nobility.sfd source file found');
    } catch {
      this.warning('Old-Country-Nobility.sfd source file not found');
    }
    
    // ClearURLs status
    this.section('ClearURLs Rules Status');
    try {
      const stat = fs.statSync('data/linkumori-clearurls-min.json.lz4');
      const sizeKB = Math.round(stat.size / 1024);
      this.success(`LZ4 rules available (${sizeKB}KB)`);
    } catch {
      this.warning('LZ4 rules not found (run clearurls)');
    }

    try {
      const stat = fs.statSync('data/linkumori-clearurls.json');
      const sizeKB = Math.round(stat.size / 1024);
      this.success(`Source rules available (${sizeKB}KB)`);
    } catch {
      this.warning('Source rules not found: data/linkumori-clearurls.json');
    }
    
    // NOTICE.md status
    try {
      const stat = fs.statSync(config.noticeFile);
      const sizeKB = Math.round(stat.size / 1024);
      this.success(`NOTICE.md found (${sizeKB}KB)`);
    } catch {
      this.warning('NOTICE.md not found (will be created on next build)');
    }
  }

  // Clean artifacts
  async clean() {
    this.section('Cleaning Build Artifacts');
    
    try {
      fs.rmSync(config.buildDir, { recursive: true, force: true });
      this.success('Removed build artifacts directory');
    } catch {
      this.warning('No build artifacts to clean');
    }
    
    // Clean generated ClearURLs files. Keep data/linkumori-clearurls.json; it is source.
    const clearurlsFiles = [
      'data/linkumori-clearurls-min.json.lz4',
      `data/${this.clearurlsConfig.outputBaseName}-clearurls-unminified.json`
    ];
    
    for (const file of clearurlsFiles) {
      try {
        fs.unlinkSync(file);
        this.success(`Removed: ${file}`);
      } catch {
        // File doesn't exist
      }
    }
    
    // Clean Old Country Nobility font build artifacts
    try {
      fs.unlinkSync('./temp-fontforge-script.pe');
      this.success('Cleaned temporary fontforge script');
    } catch {
      // Script doesn't exist
    }
    
    // Clean generated copyright documentation (keep template)
    const outputPath = config.licenseOutputDir 
      ? `${config.licenseOutputDir}/${config.licenseOutputFile}`
      : config.licenseOutputFile;
    
    try {
      fs.unlinkSync(outputPath);
      this.success(`Removed generated copyright documentation: ${outputPath}`);
    } catch {
      // File doesn't exist
    }
  }

  // Lint extension
  async lint(pslMode = 'auto') {
    this.section('Linting Extension');

    this.info('Preparing Public Suffix List for lint checks...');
    if (!(await this.ensurePslReady(pslMode))) {
      this.error('PSL preparation failed, aborting lint.');
      return false;
    }
    
    const lintArgs = ['lint', '--source-dir=' + config.sourceDir];
    const ignorePatterns = this.getIgnorePatterns();
    
    if (ignorePatterns.length > 0) {
      lintArgs.push('--ignore-files');
      lintArgs.push(...ignorePatterns);
    }
    
    const result = await this.exec('web-ext', lintArgs);
    
    if (result.success) {
      this.success('Linting completed - no issues found!');
    } else {
      this.warning('Linting completed with warnings or errors');
      this.log(result.output, 'yellow');
    }
    
    return result.success;
  }

  // Run in development mode
  async runDev() {
    this.section('Running in Development Mode');
    
    // Build first (includes copyright, clearurls and fonts)
    this.info('Building extension for development...');
    if (!(await this.buildExtension())) {
      return false;
    }
    
    const runArgs = [
      'run',
      '--browser-console',
      '--devtools',
      '--source-dir=' + config.sourceDir
    ];
    
    const ignorePatterns = this.getIgnorePatterns();
    if (ignorePatterns.length > 0) {
      runArgs.push('--ignore-files');
      runArgs.push(...ignorePatterns);
    }
    
    this.info('Starting Firefox with extension loaded...');
    this.info('Press Ctrl+C to stop');
    
    const result = await this.exec('web-ext', runArgs);
    return result.success;
  }

  async syncI18nExtra(checkOnly = false) {
    this.section('Sync i18n Keys From messages.extra.json');

    const args = ['./scripts/sync-i18n-extra.js'];
    if (checkOnly) {
      args.push('--check');
    }

    const result = await this.exec('node', args, { showOutput: true });
    if (!result.success) {
      this.error('i18n extra sync failed');
      if (result.error) {
        this.log(result.error, 'red');
      }
      return false;
    }

    this.success(checkOnly ? 'i18n extra check completed' : 'i18n extra sync completed');
    return true;
  }

  // Interactive menu
  async showMenu() {
    this.header('Linkumori Firefox Extension CLI (Enhanced)');

    const options = [
      { key: '1', name: 'Build Extension (Full Build)', action: () => this.buildExtension() },
      { key: '2', name: 'Build & Sign Extension', action: () => this.buildAndSign() },
      { key: '3', name: 'Release (Lint + Build + Sign)', action: () => this.release() },
      { key: '4', name: 'Run Development Mode', action: () => this.runDev() },
      { key: '5', name: 'Lint Extension', action: () => this.lint() },
      { key: '6', name: 'Build Old Country Nobility Font Only', action: () => this.buildOldCountryNobilityFont() },
      { key: '7', name: 'Build ClearURLs Rules Only (LZ4)', action: () => this.buildCustomClearURLs() },
      { key: '8', name: 'Generate Icon PNG Files from SVG', action: () => this.generateIcons() },
      { key: 'n', name: 'Unminify ClearURLs Rules', action: () => this.unminifyClearURLs() },
      { key: 'r', name: 'Lint  Rules ', action: () => this.lintClearURLsRules() },
      { key: '9', name: 'Generate Commit History', action: () => this.createCommitHistoryMarkdown() },
      { key: 'g', name: 'Generate Copyright Documentation Only', action: () => this.generateCopyrightDocumentation() },
      { key: 't', name: 'Create ClearURLs Source Template', action: () => this.createCustomRulesTemplate() },
      { key: 'p', name: 'Create Copyright Template', action: () => this.createCopyrightTemplate() },
      { key: 'l', name: 'Create Licenses Directory', action: () => this.createLicensesDirectory() },
      { key: 'v', name: 'Show Status', action: () => this.showStatus() },
      { key: 'u', name: 'Update PSL (Online/Offline)', action: () => this.updatePublicSuffixList('auto') },
      { key: 'x', name: 'Sync i18n Extra Keys', action: () => this.syncI18nExtra(false) },
      { key: '0', name: 'Clean Build Artifacts', action: () => this.clean() },
      { key: 's', name: 'Setup Project', action: () => this.setup() },
      { key: 'c', name: 'Convert .env.template to .env', action: () => this.convertEnvTemplate() },
      { key: 'q', name: 'Quit', action: () => process.exit(0) }
    ];
    
    this.log('\n🚀 Available Commands:', 'cyan');
    for (const option of options) {
      this.log(`  ${colors.yellow}${option.key}${colors.reset}) ${option.name}`);
    }

    this.log(`\n${colors.green}Choose an option (0-9, n, g, r, t, p, l, v, u, x, s, c, q): ${colors.reset}`, 'green');
    
    process.stdout.write('');
    const input = await this.getInput();
    const selectedOption = options.find(opt => opt.key === input?.trim());
    
    if (selectedOption) {
      console.log();
      await selectedOption.action();
      
      if (input !== 'q') {
        this.log('\nPress Enter to continue...', 'dim');
        await this.getInput();
        await this.showMenu();
      }
    } else {
      this.warning('Invalid option selected');
      setTimeout(() => this.showMenu(), 1000);
    }
  }

  // Simple input reader for Bun
  async getInput() {
    return new Promise((resolve) => {
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.once('data', (data) => {
        process.stdin.pause();
        resolve(data.toString().trim());
      });
    });
  }

  // Check if running in interactive terminal
  isInteractive() {
    return process.stdin.isTTY === true;
  }

  // Combined operations
  async buildAndSign(pslMode = 'auto') {
    if (await this.buildExtension(pslMode)) {
      return await this.signExtension();
    }
    return false;
  }

  async release(pslMode = 'auto') {
    this.header('Release Process');
    
    if (!(await this.lint(pslMode))) {
      this.error('Linting failed, aborting release');
      return false;
    }
    
    if (!(await this.buildExtension(pslMode))) {
      this.error('Build failed, aborting release');
      return false;
    }
    
    if (!(await this.signExtension())) {
      this.error('Signing failed, aborting release');
      return false;
    }
    
    this.success('Release completed successfully!');
    this.showBuildResults();
    return true;
  }

  // Setup project
  async setup() {
    this.header('Project Setup');
    
    this.section('Creating Configuration Files');
    
    // Create .env template if it doesn't exist
    try {
      fs.statSync('.env.template');
      this.info('.env.template already exists');
    } catch {
      this.createEnvTemplate();
    }
    
    // Check for .env and offer conversion
    try {
      fs.statSync('.env');
      this.warning('.env already exists');
    } catch {
      this.info('No .env file found');
      let convert = 'y';
      if (this.isInteractive()) {
        console.log('Convert .env.template to .env now? (Y/n): ');
        convert = await this.getInput();
      }
      if (convert?.toLowerCase() !== 'n') {
        this.convertEnvTemplate();
      }
    }
    
    // Create .build-ignore
    try {
      fs.statSync(config.buildIgnoreFile);
      this.warning('.build-ignore already exists');
    } catch {
      this.createBuildIgnore();
    }
    
    // Create canonical ClearURLs source template
    try {
      fs.statSync(this.clearurlsConfig.sourceRulesFile || this.clearurlsConfig.combinedRulesFile);
      this.info('ClearURLs source rules already exist');
    } catch {
      this.createCustomRulesTemplate();
    }
    
    // Create licenses directory
    try {
      fs.statSync('licenses');
      this.info('licenses/ directory already exists');
      
      // Check if README exists
      try {
        fs.statSync('licenses/README.md');
        this.info('licenses/README.md already exists');
      } catch {
        this.createLicensesDirectory();
      }
    } catch {
      this.info('No licenses/ directory found');
      let create = 'y';
      if (this.isInteractive()) {
        console.log('Create licenses/ directory with setup instructions? (Y/n): ');
        create = await this.getInput();
      }
      if (create?.toLowerCase() !== 'n') {
        this.createLicensesDirectory();
      }
    }
    
    // Create copyright template
    try {
      fs.statSync(config.licenseTemplateFile);
      this.info('Copyright template already exists');
    } catch {
      this.info('No copyright template found');
      let createTpl = 'y';
      if (this.isInteractive()) {
        console.log('Create copyright template now? (Y/n): ');
        createTpl = await this.getInput();
      }
      if (createTpl?.toLowerCase() !== 'n') {
        this.createCopyrightTemplate();
      }
    }
    
    this.section('Dependency Check');
    await this.checkDependencies();
    
    this.section('Project Validation');
    await this.validateProject();
    
    this.success('Setup completed!');
    this.info('\nNext steps:');
    this.info('1. Download license files into licenses/ directory (see licenses/README.md)');
    this.info('2. Edit .env with your Mozilla API credentials');
    this.info('3. Set your WEB_EXT_CHANNEL (listed or unlisted)');
    this.info('4. Edit Template.md with your copyright info');
    this.info('5. Edit data/linkumori-clearurls.json with bundled URL cleaning rules');
    this.info('6. Run option 1 to build your extension');
  }

  // Main entry point
  async run() {
    // Check if web-ext is available
    const webExtCheck = await this.exec('which', ['web-ext']);
    if (!webExtCheck.success) {
      this.error('web-ext not found. Install with: npm install -g web-ext');
      this.info('Or run setup first');
      process.exit(1);
    }
    
    // Handle command line arguments
    const args = process.argv.slice(2);
    if (args.length > 0) {
      this.printLicenseBanner();
      const command = args[0];
      
      switch (command) {
        case 'build':
          await this.buildExtension(args[1] || 'auto');
          break;
        case 'sign':
          await this.signExtension();
          break;
        case 'build-and-sign':
          await this.buildAndSign(args[1] || 'auto');
          break;
        case 'release':
          await this.release(args[1] || 'auto');
          break;
        case 'dev':
        case 'run':
          await this.runDev();
          break;
        case 'lint':
          await this.lint(args[1] || 'auto');
          break;
        case 'fonts':
          await this.buildOldCountryNobilityFont();
          break;
        case 'clearurls':
          await this.buildCustomClearURLs();
          break;
        case 'icons':
          await this.generateIcons();
          break;
        case 'lint-rules':
        case 'lint-clearurls':
          // pass explicit path if given; null triggers the interactive prompt
          await this.lintClearURLsRules(args[1] || null);
          break;
        case 'compress-lz4':
          if (!args[1]) {
            this.error('Missing input file. Example: node linkumori-cli-tool.js compress-lz4 data/linkumori-clearurls.json');
            process.exit(1);
          }
          {
            const stats = this.writeLZ4CompressedFile(args[1], args[2] || `${args[1]}.lz4`);
            this.success(`LZ4 compressed file saved to: ${stats.outputFile}`);
            this.info(`Input: ${stats.inputSize} bytes`);
            this.info(`Output: ${stats.outputSize} bytes (${((1 - stats.ratio) * 100).toFixed(1)}% smaller)`);
          }
          break;

        case 'unminify':
        case 'unminify-clearurls':
          await this.unminifyClearURLs();
          break;
        case 'clearurls-template':
          this.createCustomRulesTemplate();
          break;
        case 'commit-history':
        case 'commits':
          await this.createCommitHistoryMarkdown();
          break;
        case 'copyright':
        case 'license':
          await this.generateCopyrightDocumentation();
          break;
        case 'copyright-template':
        case 'license-template':
          this.createCopyrightTemplate();
          break;
        case 'licenses':
        case 'create-licenses':
          this.createLicensesDirectory();
          break;
        case 'status':
          this.showStatus();
          break;
        case 'clean':
          await this.clean();
          break;
        case 'setup':
          await this.setup();
          break;
        case 'convert-env':
          this.convertEnvTemplate();
          break;
        case 'deps':
        case 'dependencies':
          await this.checkDependencies();
          break;
        case 'sync-i18n-extra':
          await this.syncI18nExtra(false);
          break;
        case 'sync-i18n-extra-check':
          await this.syncI18nExtra(true);
          break;
        case 'psl':
          await this.updatePublicSuffixList(args[1] || 'auto');
          break;
        case 'psl-online':
          await this.updatePublicSuffixList('online');
          break;
        case 'psl-offline':
          await this.updatePublicSuffixList('offline');
          break;
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
        default:
          this.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
      return;
    }
    
    // Start interactive menu if no arguments
    console.clear();
    this.printLicenseBanner();
    await this.showMenu();
  }

  // Show command line help
  showHelp() {
    this.header('Linkumori CLI - Command Line Usage (Bun Version - Enhanced)');
    
    this.log('\nUsage:', 'cyan');
    this.log('  bun run linkumori-cli-bun-merged.js [command]', 'white');
    this.log('  bun run linkumori-cli-bun-merged.js              # Interactive menu', 'dim');
    
    this.log('\nCommands:', 'cyan');
    this.log('  build                 Build extension (copyright + clearurls + fonts + icons + web-ext)', 'white');
    this.log('  build-and-sign        Build and sign extension', 'white');
    this.log('  release               Full release process (lint + build + sign)', 'white');
    this.log('  dev, run              Run in development mode', 'white');
    this.log('  lint                  Lint extension code', 'white');
    this.log('  fonts                 Build Old Country Nobility Font only', 'white');
    this.log('  clearurls             Build ClearURLs LZ4 rules only', 'white');
    this.log('  icons                 Generate icon PNG files from SVG sources', 'white');
    this.log('  lint-rules            Lint ClearURLs rules, including .lz4 output', 'white');
    this.log('  lint-clearurls        Alias for lint-rules', 'white');
    this.log('  compress-lz4          Create a Linkumori LZ4 copy of a JSON file', 'white');
    this.log('  unminify              Unminify ClearURLs rules to readable JSON', 'white');
    this.log('  commit-history        Create formatted markdown of git commit history', 'white');
    this.log('  clearurls-template    Create ClearURLs source template', 'white');
    this.log('  copyright, license    Generate copyright documentation only', 'white');
    this.log('  copyright-template    Create copyright template', 'white');
    this.log('  licenses              Create licenses directory with README', 'white');
    this.log('  status                Show project status', 'white');
    this.log('  clean                 Clean build artifacts', 'white');
    this.log('  setup                 Initialize project configuration', 'white');
    this.log('  convert-env           Convert .env.template to .env', 'white');
    this.log('  deps                  Check and install dependencies', 'white');
    this.log('  sync-i18n-extra       Sync missing used keys from messages.extra.json', 'white');
    this.log('  sync-i18n-extra-check Check for missing used keys from messages.extra.json', 'white');
    this.log('  (mode arg)            Optional PSL mode for build/lint/release/build-and-sign: online|offline|auto', 'white');
    this.log('  psl [online|offline]  Update/load public_suffix_list.dat', 'white');
    this.log('  psl-online            Download latest public_suffix_list.dat', 'white');
    this.log('  psl-offline           Use existing local public_suffix_list.dat', 'white');
    this.log('  help                  Show this help message', 'white');
    
    this.log('\nExamples:', 'cyan');
    this.log('  bun run linkumori-cli-bun-merged.js build', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js build offline', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js licenses', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js copyright', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js clearurls', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js icons', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js lint-rules', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js compress-lz4 data/linkumori-clearurls.json', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js serialize-url-patterns data/linkumori-clearurls-min.json.lz4', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js benchmark-url-patterns data/linkumori-clearurls-min.json.lz4 1000 urls.txt', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js unminify', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js commit-history', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js release', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js dev', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js sync-i18n-extra', 'dim');
    this.log('  bun run linkumori-cli-bun-merged.js psl online', 'dim');
    
    this.log('\n🆕 Enhanced Features:', 'cyan');
    this.log('  - Local license file loading (no internet required)', 'white');
    this.log('  - Canonical ClearURLs source JSON: data/linkumori-clearurls.json', 'white');
    this.log('  - LZ4 bundle generation from the canonical source JSON', 'white');
    this.log('  - Git commit history markdown generator', 'white');
    this.log('  - Automatic NOTICE.md creation and updating', 'white');
    this.log('  - Detailed build statistics and reporting', 'white');
    this.log('  - Enhanced emoji-based console output', 'white');
    this.log('  - Better duplicate rule detection', 'white');
    this.log('  - Timestamp placeholder support in copyright templates', 'white');
    
    this.log('\nBuild Process:', 'cyan');
    this.log('  The build command performs these steps in order:', 'white');
    this.log('  1. Generate copyright documentation with embedded licenses', 'dim');
    this.log('  2. Build ClearURLs LZ4 bundle from data/linkumori-clearurls.json', 'dim');
    this.log('  3. Build Old Country Nobility Font (.sfd → .ttf)', 'dim');
    this.log('  4. Generate icon PNG files from linkumori_icons.svg and linkumori_icon_disabled.svg', 'dim');
    this.log('  5. Validate project structure', 'dim');
    this.log('  6. Build extension package with web-ext', 'dim');
    
    this.log('\nLicense Files Setup:', 'cyan');
    this.log('  License texts are loaded from local files:', 'white');
    this.log('  1. Run "licenses" or "setup" command to create licenses/ directory', 'dim');
    this.log('  2. Download license files from official sources (see licenses/README.md)', 'dim');
    this.log('  3. Place them in licenses/ directory with correct filenames:', 'dim');
    this.log('     - licenses/MIT.txt', 'dim');
    this.log('     - licenses/GPL-3.0.txt', 'dim');
    this.log('     - licenses/LGPL-3.0.txt', 'dim');
    this.log('     - licenses/APACHE-2.0.txt', 'dim');
    this.log('     - licenses/CC0-1.0.txt', 'dim');
    this.log('     - licenses/MPL-2.0.txt', 'dim');
    this.log('     - licenses/ISC.txt', 'dim');
    this.log('     - licenses/unlicense.txt', 'dim');
    this.log('     - licenses/MarkedJS.txt', 'dim');
    this.log('  4. Build process will read and embed them automatically', 'dim');
    
    this.log('\nCopyright Template Placeholders:', 'cyan');
    this.log('  Available placeholders in Template.md:', 'white');
    this.log('  - {{LICENSE:MIT}}                     - Embeds MIT license text', 'dim');
    this.log('  - {{LICENSE:GPL-3.0}}                 - Embeds GPL 3.0 license text', 'dim');
    this.log('  - {{LICENSE:LGPL-3.0}}                - Embeds LGPL 3.0 license text', 'dim');
    this.log('  - {{LICENSE:APACHE-2.0}}              - Embeds Apache 2.0 license text', 'dim');
    this.log('  - {{LICENSE:CC0-1.0}}                 - Embeds CC0 1.0 license text', 'dim');
    this.log('  - {{LICENSE:MPL-2.0}}                 - Embeds MPL 2.0 license text', 'dim');
    this.log('  - {{LICENSE:ISC}}                     - Embeds ISC license text', 'dim');
    this.log('  - {{LICENSE:UNLICENSE}}               - Embeds The Unlicense text', 'dim');
    this.log('  - {{LICENSE:MARKEDJS}}                - Embeds the MarkedJS attribution notice', 'dim');
    this.log('  - {{CURRENT-TIME-WITH-DEVICE-TIME-ZONE}} - Current timestamp with timezone', 'dim');
    this.log('  Example: 2025-02-08 14:30:45 UTC+05:30 (Asia/Kolkata)', 'dim');
    
    this.log('\nClearURLs Source Bundle:', 'cyan');
    this.log('  The ClearURLs builder:', 'white');
    this.log('  - Reads data/linkumori-clearurls.json as the source of truth', 'dim');
    this.log('  - Normalizes the wrapped ClearURLsData JSON without writing metadata to source', 'dim');
    this.log('  - Injects Linkumori metadata only into data/linkumori-clearurls-min.json.lz4', 'dim');
    this.log('  - Does not download or merge downloaded-official-rules.json/custom-rules.json', 'dim');
    this.log('  - Generates detailed statistics and documentation', 'dim');
    this.log('  - Creates/updates NOTICE.md with build history', 'dim');
    this.log('  - Uses automatic version numbering (dd.mm.yyyy.HHMM)', 'dim');

    this.log('\nUnminify ClearURLs:', 'cyan');
    this.log('  The unminify command:', 'white');
    this.log('  - Reads linkumori-clearurls-min.json.lz4 by default', 'dim');
    this.log('  - Creates linkumori-clearurls-unminified.json with pretty formatting', 'dim');
    this.log('  - Shows size comparison and expansion details', 'dim');
    this.log('  - Useful for debugging and manual rule inspection', 'dim');

    this.log('\nLint ClearURLs Rules (lint-rules / lint-clearurls):', 'cyan');
    this.log('  Validates a rules JSON file by replaying clearurls.js logic.', 'white');
    this.log('  Default target: data/linkumori-clearurls.json', 'white');
    this.log('  Auto-detects both JSON formats:', 'dim');
    this.log('    • Wrapped { providers } source JSON', 'dim');
    this.log('    • Wrapped { metadata, providers } LZ4 payload', 'dim');
    this.log('      ← linkumori-clearurls.json / linkumori-clearurls-min.json.lz4', 'dim');
    this.log('    • Flat  { providerName: {...} }          ← legacy imports', 'dim');
    this.log('  Checks per provider (unified syntax, docs/rule-syntax.md):', 'dim');
    this.log('    - "match" has at least one pattern', 'dim');
    this.log('    - every "rules" filter parses: $removeparam, @@, $redirect, $strip, $block', 'dim');
    this.log('    - regexes compile; regex $redirect has a capture group or a target', 'dim');
    this.log('    - older multi-section providers are reported (convert-rule-syntax)', 'dim');
    this.log('  Functional smoke tests (URL-pattern based, no hardcoded provider names):', 'dim');
    this.log('    Amazon qid/pd_rd_r/tag, Global utm_*/fbclid,', 'dim');
    this.log('    Google ved/ei/source, YouTube si/feature, Facebook hc_ref', 'dim');
    this.log('    Tests are skipped (not failed) when no provider in the file matches', 'dim');
    this.log('  Optional path argument:', 'dim');
    this.log('    bun linkumori-cli-tool.js lint-rules data/linkumori-clearurls.json', 'dim');

    this.log('\nCommit History Generator:', 'cyan');
    this.log('  The commit-history command creates a formatted markdown file with:', 'white');
    this.log('  - Commit author name and email', 'dim');
    this.log('  - Commit date and timestamp', 'dim');
    this.log('  - Full commit hash and short hash', 'dim');
    this.log('  - List of modified files with status (Added/Modified/Deleted)', 'dim');
    this.log('  - Full commit message for each commit', 'dim');
    this.log('  - Outputs to COMMIT_HISTORY.md by default', 'dim');
  }
}

// Run the CLI
if (import.meta.main) {
  const cli = new LinkumoriCLI();
  await cli.run();
}
