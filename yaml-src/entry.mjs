// The `yaml` package (https://github.com/eemeli/yaml, ISC license) as one browser file,
// for the rules editor's YAML parsing, error positions and output. Exposes window.LinkumoriYAML.
// The editor itself is our own (code-editor.js); this is its only third-party code.
//
//   bun install && bun run build
import * as YAML from 'yaml';
window.LinkumoriYAML = YAML;
