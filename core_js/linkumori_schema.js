/*
 * ============================================================
 * Linkumori — rule file JSON Schemas
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * Loads the schemas shipped in schema/ from the extension itself
 * (browser.runtime.getURL, never the network) and checks values against
 * them. Only the keywords those schemas use are supported: type, enum,
 * const, properties, additionalProperties, required, propertyNames,
 * items, minItems, uniqueItems, minLength, minimum, pattern, format
 * ("regex"), allOf, anyOf, oneOf, not, if/then/else and $ref (within a
 * schema file or to another one in schema/).
 *
 * Loaded as a classic script (custom rules page); read
 * globalThis.LinkumoriSchema.
 * ============================================================
 */
(function (root) {
    'use strict';

    const RULES_SCHEMA = 'linkumori-rules.schema.json';
    const EXPORT_SCHEMA = 'linkumori-custom-rules-export.schema.json';
    const SCHEMA_FILES = Object.freeze([RULES_SCHEMA, EXPORT_SCHEMA]);

    const schemas = new Map();
    const patternCache = new Map();
    let loading = null;

    function getRuntime() {
        if (typeof browser !== 'undefined' && browser.runtime) return browser.runtime;
        if (typeof chrome !== 'undefined' && chrome.runtime) return chrome.runtime;
        return null;
    }

    function getSchemaUrl(file) {
        const runtime = getRuntime();
        return runtime ? runtime.getURL(`schema/${file}`) : '';
    }

    // Reads both schemas from the extension package once; resolves to true
    // when they are ready, false when they could not be read.
    function load() {
        if (!loading) {
            loading = Promise.all(SCHEMA_FILES.map(async (file) => {
                const url = getSchemaUrl(file);
                if (!url) throw new Error('browser.runtime is not available');
                const response = await fetch(url);
                if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
                schemas.set(file, await response.json());
            })).then(() => true, () => {
                schemas.clear();
                return false;
            });
        }
        return loading;
    }

    function isReady() {
        return SCHEMA_FILES.every(file => schemas.has(file));
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function typeOf(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
        return typeof value;
    }

    function matchesType(value, type) {
        const actual = typeOf(value);
        return actual === type || (type === 'number' && actual === 'integer');
    }

    function testPattern(pattern, text) {
        let regex = patternCache.get(pattern);
        if (!regex) {
            regex = new RegExp(pattern, 'u');
            patternCache.set(pattern, regex);
        }
        return regex.test(text);
    }

    function deepEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    // "#/$defs/x" within the current file, or "file.json#/…" in schema/.
    function resolveRef(ref, file) {
        const hashAt = ref.indexOf('#');
        const target = hashAt > 0 ? ref.slice(0, hashAt) : (hashAt === -1 ? ref : file);
        const pointer = hashAt === -1 ? '' : ref.slice(hashAt + 1);
        let node = schemas.get(target);
        if (node === undefined) throw new Error(`Unknown schema reference "${ref}"`);
        pointer.split('/').slice(1).forEach((part) => {
            node = node[part.replace(/~1/g, '/').replace(/~0/g, '~')];
            if (node === undefined) throw new Error(`Unknown schema reference "${ref}"`);
        });
        return { schema: node, file: target };
    }

    function joinPath(path, key) {
        if (typeof key === 'number') return `${path}[${key}]`;
        return path ? `${path}.${key}` : key;
    }

    // Appends { path, message } for every way `value` breaks `schema`.
    // With `errors` null it stops at the first problem and only answers
    // whether the value is valid (used for if/not/anyOf/oneOf branches).
    function check(value, schema, file, path, errors) {
        if (schema === true) return true;
        if (schema === false) {
            if (errors) errors.push({ path, message: 'is not allowed here' });
            return false;
        }
        let valid = true;
        const fail = (message, at = path) => {
            valid = false;
            if (errors) errors.push({ path: at, message });
            return !errors;
        };

        if (schema.$ref) {
            const resolved = resolveRef(schema.$ref, file);
            if (!check(value, resolved.schema, resolved.file, path, errors)) {
                valid = false;
                if (!errors) return false;
            }
        }

        if (schema.type !== undefined) {
            const types = Array.isArray(schema.type) ? schema.type : [schema.type];
            if (!types.some(type => matchesType(value, type))) {
                fail(`must be ${types.map(type => (type === 'array' || type === 'object' || type === 'integer') ? `an ${type}` : `a ${type}`).join(' or ')}`);
                return false;
            }
        }
        if (schema.const !== undefined && !deepEqual(value, schema.const)) {
            if (fail(`must be ${JSON.stringify(schema.const)}`)) return false;
        }
        if (schema.enum && !schema.enum.some(option => deepEqual(value, option))) {
            if (fail(`must be one of: ${schema.enum.join(', ')}`)) return false;
        }

        if (typeof value === 'string') {
            if (schema.minLength !== undefined && [...value].length < schema.minLength) {
                if (fail(schema.minLength === 1 ? 'must not be empty' : `must be at least ${schema.minLength} characters`)) return false;
            }
            if (schema.pattern !== undefined && !testPattern(schema.pattern, value)) {
                if (fail(schema.description ? `does not have the expected form: ${schema.description}` : `must match ${schema.pattern}`)) return false;
            }
            if (schema.format === 'regex') {
                try {
                    new RegExp(value);
                } catch (error) {
                    if (fail(`is not a valid regular expression: ${error.message}`)) return false;
                }
            }
        }
        if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
            if (fail(`must be ${schema.minimum} or more`)) return false;
        }

        if (Array.isArray(value)) {
            if (schema.minItems !== undefined && value.length < schema.minItems) {
                if (fail(`must have at least ${schema.minItems} item(s)`)) return false;
            }
            if (schema.uniqueItems) {
                const seen = new Set();
                for (let index = 0; index < value.length; index++) {
                    const key = JSON.stringify(value[index]);
                    if (seen.has(key) && fail('repeats an earlier item', joinPath(path, index))) return false;
                    seen.add(key);
                }
            }
            if (schema.items !== undefined) {
                for (let index = 0; index < value.length; index++) {
                    if (!check(value[index], schema.items, file, joinPath(path, index), errors)) {
                        valid = false;
                        if (!errors) return false;
                    }
                }
            }
        }

        if (isPlainObject(value)) {
            (schema.required || []).forEach((key) => {
                if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`is missing "${key}"`);
            });
            if (!valid && !errors) return false;
            const properties = schema.properties || {};
            for (const key of Object.keys(value)) {
                const at = joinPath(path, key);
                if (schema.propertyNames && !check(key, schema.propertyNames, file, at, null)) {
                    if (fail('has an invalid name', at)) return false;
                }
                if (Object.prototype.hasOwnProperty.call(properties, key)) {
                    if (properties[key] === false) {
                        if (fail(`has "${key}", which does nothing here`, at)) return false;
                    } else if (!check(value[key], properties[key], file, at, errors)) {
                        valid = false;
                        if (!errors) return false;
                    }
                } else if (schema.additionalProperties === false) {
                    if (fail(`has unknown key "${key}"`, at)) return false;
                } else if (isPlainObject(schema.additionalProperties)) {
                    if (!check(value[key], schema.additionalProperties, file, at, errors)) {
                        valid = false;
                        if (!errors) return false;
                    }
                }
            }
        }

        for (const part of schema.allOf || []) {
            if (!check(value, part, file, path, errors)) {
                valid = false;
                if (!errors) return false;
            }
        }
        if (schema.anyOf && !schema.anyOf.some(part => check(value, part, file, path, null))) {
            const problem = describeAlternatives(schema.anyOf, value, file, path, 'anyOf');
            if (fail(problem.message, problem.path)) return false;
        }
        if (schema.oneOf) {
            const matches = schema.oneOf.filter(part => check(value, part, file, path, null)).length;
            const problem = matches === 0
                ? describeAlternatives(schema.oneOf, value, file, path, 'oneOf')
                : { path, message: 'matches more than one allowed form' };
            if (matches !== 1 && fail(problem.message, problem.path)) return false;
        }
        if (schema.not && check(value, schema.not, file, path, null)) {
            if (fail(describeNot(schema, value))) return false;
        }
        if (schema.if !== undefined) {
            const branch = check(value, schema.if, file, path, null) ? schema.then : schema.else;
            if (branch !== undefined && !check(value, branch, file, path, errors)) {
                valid = false;
                if (!errors) return false;
            }
        }
        return valid;
    }

    // With one branch left that fits the value's type, its own first
    // problem says more than "matches no allowed form". Returns { path, message }.
    function describeAlternatives(parts, value, file, path, keyword) {
        const sameType = parts.filter((part) => {
            const type = getSchemaType(part, file);
            return type === undefined || matchesType(value, type);
        });
        if (sameType.length === 1) {
            const inner = [];
            check(value, sameType[0], file, path, inner);
            if (inner.length) return inner[0];
        }
        if (keyword === 'anyOf' && isPlainObject(value) && parts.every(part => Array.isArray(part.required))) {
            return { path, message: `needs one of: ${parts.map(part => part.required.join(' + ')).join(', ')}` };
        }
        return { path, message: 'does not match any allowed form' };
    }

    // The type a (sub)schema expects, following $ref and allOf.
    function getSchemaType(schema, file, depth = 0) {
        if (!isPlainObject(schema) || depth > 8) return undefined;
        if (schema.type !== undefined) return schema.type;
        if (schema.$ref) {
            const resolved = resolveRef(schema.$ref, file);
            return getSchemaType(resolved.schema, resolved.file, depth + 1);
        }
        for (const part of schema.allOf || []) {
            const type = getSchemaType(part, file, depth + 1);
            if (type !== undefined) return type;
        }
        return undefined;
    }

    function describeNot(schema, value) {
        const inner = schema.not;
        if (Array.isArray(inner.required) && isPlainObject(value)) {
            return `must not have both ${inner.required.map(key => `"${key}"`).join(' and ')}`;
        }
        if (inner.pattern && typeof value === 'string') {
            return schema.description ? `is not allowed: ${schema.description}` : 'has a form that is not allowed';
        }
        return 'has a form that is not allowed';
    }

    // Problems in one provider; [] when the schemas are not loaded yet.
    function validateProvider(provider) {
        if (!isReady()) return [];
        const errors = [];
        check(provider, { $ref: '#/$defs/provider' }, RULES_SCHEMA, '', errors);
        return dedupe(errors);
    }

    // Problems in a rules file or a custom rules export.
    function validateFile(data, kind = 'rules') {
        if (!isReady()) return [];
        const file = kind === 'export' ? EXPORT_SCHEMA : RULES_SCHEMA;
        const errors = [];
        check(data, schemas.get(file), file, '', errors);
        return dedupe(errors);
    }

    function dedupe(errors) {
        const seen = new Set();
        return errors.filter((error) => {
            const key = `${error.path}\u0000${error.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    root.LinkumoriSchema = Object.freeze({
        RULES_SCHEMA,
        EXPORT_SCHEMA,
        getSchemaUrl,
        load,
        isReady,
        validateProvider,
        validateFile
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
