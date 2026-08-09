/*
 * Linkumori shared accessibility tools.
 *
 * Copyright (c) 2026 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * 2026-08-09   Subham Mahesh   Added shared accessibility tools.
 * 2026-08-09   Subham Mahesh   Added full widget feature controls.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'linkumori_accessibility_tools_v1';
    const FONT_LEVELS = [-2, -1, 0, 1, 2, 3];
    const CONTRAST_LEVELS = ['medium', 'high', 'ultra'];
    const TEXT_SPACING_LEVELS = ['light', 'medium', 'heavy'];
    const LINE_HEIGHT_LEVELS = ['2em', '3em', '4em'];
    const FONT_FAMILIES = ['arial', 'times', 'verdana'];
    const COLOR_FILTERS = ['protanopia', 'deuteranopia', 'tritanopia', 'grayscale'];
    const TEXT_ALIGNMENTS = ['left', 'center', 'right'];
    const SATURATION_LEVELS = ['low', 'high', 'none'];

    const DEFAULT_STATE = Object.freeze({
        contrast: 'normal',
        highlightLinks: false,
        invert: false,
        saturation: 'default',
        fontLevel: 0,
        textSpacing: 'default',
        lineHeight: 'default',
        hideImages: false,
        bigCursor: false,
        pauseAnimations: false,
        dyslexiaFont: false,
        fontFamily: 'default',
        colorFilter: 'default',
        textAlign: 'default'
    });

    const VALUE_LABELS = Object.freeze({
        contrast: {
            normal: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            medium: { key: 'accessibility_tools_value_medium', fallback: 'Medium' },
            high: { key: 'accessibility_tools_value_high', fallback: 'High' },
            ultra: { key: 'accessibility_tools_value_ultra', fallback: 'Ultra' }
        },
        saturation: {
            default: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            low: { key: 'accessibility_tools_value_low', fallback: 'Low' },
            high: { key: 'accessibility_tools_value_high', fallback: 'High' },
            none: { key: 'accessibility_tools_value_none', fallback: 'None' }
        },
        textSpacing: {
            default: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            light: { key: 'accessibility_tools_value_light', fallback: 'Light' },
            medium: { key: 'accessibility_tools_value_medium', fallback: 'Medium' },
            heavy: { key: 'accessibility_tools_value_heavy', fallback: 'Heavy' }
        },
        lineHeight: {
            default: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            '2em': { key: 'accessibility_tools_value_2x', fallback: '2x' },
            '3em': { key: 'accessibility_tools_value_3x', fallback: '3x' },
            '4em': { key: 'accessibility_tools_value_4x', fallback: '4x' }
        },
        fontFamily: {
            default: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            arial: { key: 'accessibility_tools_value_arial', fallback: 'Arial' },
            times: { key: 'accessibility_tools_value_times', fallback: 'Times' },
            verdana: { key: 'accessibility_tools_value_verdana', fallback: 'Verdana' }
        },
        colorFilter: {
            default: { key: 'accessibility_tools_value_no_filter', fallback: 'No Filter' },
            protanopia: { key: 'accessibility_tools_value_protanopia', fallback: 'Protanopia' },
            deuteranopia: { key: 'accessibility_tools_value_deuteranopia', fallback: 'Deuteranopia' },
            tritanopia: { key: 'accessibility_tools_value_tritanopia', fallback: 'Tritanopia' },
            grayscale: { key: 'accessibility_tools_value_grayscale', fallback: 'Grayscale' }
        },
        textAlign: {
            default: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            left: { key: 'accessibility_tools_value_left', fallback: 'Left' },
            center: { key: 'accessibility_tools_value_center', fallback: 'Center' },
            right: { key: 'accessibility_tools_value_right', fallback: 'Right' }
        },
        fontLevel: {
            '-2': { key: 'accessibility_tools_value_extra_small', fallback: 'Extra Small' },
            '-1': { key: 'accessibility_tools_value_small', fallback: 'Small' },
            0: { key: 'accessibility_tools_value_default', fallback: 'Default' },
            1: { key: 'accessibility_tools_value_large', fallback: 'Large' },
            2: { key: 'accessibility_tools_value_extra_large', fallback: 'Extra Large' },
            3: { key: 'accessibility_tools_value_largest', fallback: 'Largest' }
        }
    });

    const ICONS = Object.freeze({
        accessibility: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.25" r="2.25"></circle><path d="M4 8.25h16"></path><path d="M12 6.75v6.25"></path><path d="M8.25 20l3.75-7 3.75 7"></path></svg>',
        contrast: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"></circle><path d="M12 4a8 8 0 0 1 0 16z"></path></svg>',
        link: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 14.5 14.5 9.5"></path><path d="M8.5 9h-1a4 4 0 0 0 0 8h4a4 4 0 0 0 3.75-2.62"></path><path d="M15.5 15h1a4 4 0 0 0 0-8h-4a4 4 0 0 0-3.75 2.62"></path></svg>',
        invert: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7"></circle><path d="M12 5v14"></path></svg>',
        saturation: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3c4 4.5 6 7.75 6 10.25A6 6 0 0 1 6 13.25C6 10.75 8 7.5 12 3z"></path><path d="M12 3v16"></path></svg>',
        colorFilter: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="8.5" cy="9" r="3.5"></circle><circle cx="15.5" cy="9" r="3.5"></circle><circle cx="12" cy="15" r="3.5"></circle></svg>',
        textAlign: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14"></path><path d="M5 10h10"></path><path d="M5 14h14"></path><path d="M5 18h10"></path></svg>',
        textSpacing: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h10"></path><path d="M12 5v12"></path><path d="M9 17h6"></path><path d="M4 19h16"></path><path d="M6 17 4 19l2 2"></path><path d="M18 17l2 2-2 2"></path></svg>',
        lineHeight: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h8"></path><path d="M8 12h8"></path><path d="M8 19h8"></path><path d="M4 6v12"></path><path d="m2.5 8 1.5-2 1.5 2"></path><path d="m2.5 16 1.5 2 1.5-2"></path></svg>',
        hideImages: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="m4 4 16 16"></path><path d="m7 16 3-3 2 2 1.25-1.25"></path><circle cx="16" cy="9" r="1.5"></circle></svg>',
        cursor: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 3 6 17 2.25-6.25L19.5 11 5 3z"></path><path d="M15 3v3"></path><path d="M18.5 4.5 16.4 6.6"></path><path d="M20 8h-3"></path></svg>',
        pause: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"></circle><path d="M10 8v8"></path><path d="M14 8v8"></path></svg>',
        dyslexia: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4h6a6 6 0 0 1 0 12H6z"></path><path d="M6 16v4"></path><path d="M5 20h9"></path></svg>',
        reset: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5v5h5"></path><path d="M20 19v-5h-5"></path><path d="M6.25 10A7 7 0 0 1 18 6.25"></path><path d="M17.75 14A7 7 0 0 1 6 17.75"></path></svg>',
        close: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>',
        cursorShape: '<svg viewBox="0 0 38 38" aria-hidden="true" focusable="false"><path d="M6 3v28l8.4-7.1 4.6 10.3 5.3-2.4-4.7-10.1 11.1-.8L6 3z"></path></svg>'
    });

    const TOOL_GROUPS = Object.freeze([
        {
            titleKey: 'accessibility_tools_group_vision',
            titleFallback: 'Vision',
            tools: [
                { action: 'contrast-cycle', labelKey: 'accessibility_tools_high_contrast', labelFallback: 'High Contrast', icon: ICONS.contrast, steps: CONTRAST_LEVELS.length },
                { action: 'color-filter', labelKey: 'accessibility_tools_color_filter', labelFallback: 'Color Filter', icon: ICONS.colorFilter, steps: COLOR_FILTERS.length },
                { action: 'saturation', labelKey: 'accessibility_tools_saturation', labelFallback: 'Saturation', icon: ICONS.saturation, steps: SATURATION_LEVELS.length },
                { action: 'invert', labelKey: 'accessibility_tools_invert', labelFallback: 'Invert', icon: ICONS.invert },
                { action: 'highlight-links', labelKey: 'accessibility_tools_highlight_links', labelFallback: 'Highlight Links', icon: ICONS.link },
                { action: 'hide-images', labelKey: 'accessibility_tools_hide_images', labelFallback: 'Hide Images', icon: ICONS.hideImages }
            ]
        },
        {
            titleKey: 'accessibility_tools_group_reading',
            titleFallback: 'Reading',
            tools: [
                { action: 'font-increase', labelKey: 'accessibility_tools_text_size_increase', labelFallback: 'Text Size Increase', textIcon: 'A+' },
                { action: 'font-decrease', labelKey: 'accessibility_tools_text_size_decrease', labelFallback: 'Text Size Decrease', textIcon: 'A-' },
                { action: 'font-normal', labelKey: 'accessibility_tools_default_text_size', labelFallback: 'Default Text Size', textIcon: 'A' },
                { action: 'font-selection', labelKey: 'accessibility_tools_font_selection', labelFallback: 'Font Selection', textIcon: 'Ff', steps: FONT_FAMILIES.length },
                { action: 'dyslexia-font', labelKey: 'accessibility_tools_dyslexia_friendly', labelFallback: 'Dyslexia Friendly', icon: ICONS.dyslexia },
                { action: 'text-spacing', labelKey: 'accessibility_tools_text_spacing', labelFallback: 'Text Spacing', icon: ICONS.textSpacing, steps: TEXT_SPACING_LEVELS.length },
                { action: 'line-height', labelKey: 'accessibility_tools_line_height', labelFallback: 'Line Height', icon: ICONS.lineHeight, steps: LINE_HEIGHT_LEVELS.length },
                { action: 'text-align', labelKey: 'accessibility_tools_text_align', labelFallback: 'Text Align', icon: ICONS.textAlign, steps: TEXT_ALIGNMENTS.length }
            ]
        },
        {
            titleKey: 'accessibility_tools_group_interaction',
            titleFallback: 'Interaction',
            tools: [
                { action: 'pause-animations', labelKey: 'accessibility_tools_pause_animations', labelFallback: 'Pause Animations', icon: ICONS.pause },
                { action: 'big-cursor', labelKey: 'accessibility_tools_bigger_cursor', labelFallback: 'Bigger Cursor', icon: ICONS.cursor }
            ]
        }
    ]);

    let state = { ...DEFAULT_STATE };
    let root;
    let modal;
    let trigger;
    let backdrop;
    let liveRegion;
    let bigCursor;
    let lastFocusedElement = null;
    let isModalOpen = false;
    let isTrackingCursor = false;
    let isListeningForExternalState = false;

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
            return;
        }

        callback();
    }

    async function init() {
        if (!document.body || document.getElementById('linkumoriA11yTools')) {
            return;
        }

        state = normalizeState(await loadState());
        await waitForI18n();
        createWidget();
        registerExternalStateListeners();
        applyState();
        updateControls();
    }

    async function waitForI18n() {
        const i18n = globalThis.LinkumoriI18n;

        if (!i18n || typeof i18n.ready !== 'function') {
            return;
        }

        try {
            await i18n.ready();
        } catch (error) {
            // Fall back to browser.i18n or bundled English strings.
        }
    }

    function translate(key, fallback, substitutions) {
        const customI18n = globalThis.LinkumoriI18n;
        const normalizedSubstitutions = substitutions === undefined ? undefined : substitutions;

        if (
            customI18n
            && typeof customI18n.getMessage === 'function'
            && (!customI18n.isReady || customI18n.isReady())
        ) {
            const message = customI18n.getMessage(key, normalizedSubstitutions);

            if (message && message !== key) {
                return message;
            }
        }

        const extensionI18n = getBrowserI18n();

        if (extensionI18n && typeof extensionI18n.getMessage === 'function') {
            const message = extensionI18n.getMessage(key, normalizedSubstitutions);

            if (message) {
                return message;
            }
        }

        return formatFallback(fallback || key, normalizedSubstitutions);
    }

    function getBrowserI18n() {
        if (globalThis.browser && globalThis.browser.i18n) {
            return globalThis.browser.i18n;
        }

        if (globalThis.chrome && globalThis.chrome.i18n) {
            return globalThis.chrome.i18n;
        }

        return null;
    }

    function formatFallback(fallback, substitutions) {
        if (substitutions === undefined || substitutions === null) {
            return fallback;
        }

        const values = Array.isArray(substitutions) ? substitutions : [substitutions];

        return String(fallback).replace(/\$(\d+)/g, (match, index) => {
            const value = values[Number(index) - 1];
            return value === undefined ? match : String(value);
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getToolLabel(tool) {
        return translate(tool.labelKey, tool.labelFallback);
    }

    function getGroupTitle(group) {
        return translate(group.titleKey, group.titleFallback);
    }

    async function loadState() {
        const extensionState = await readExtensionStorage();
        if (extensionState) {
            return extensionState;
        }

        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (error) {
            return {};
        }
    }

    async function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage failures; the active page still receives the setting.
        }

        await writeExtensionStorage(state);
    }

    async function readExtensionStorage() {
        const storageAreas = getExtensionStorageAreas();

        for (const storage of storageAreas) {
            try {
                const storedState = await storage.get(STORAGE_KEY);

                if (storedState) {
                    return storedState;
                }
            } catch (error) {
                // Fall through to the next storage area.
            }
        }

        return null;
    }

    async function writeExtensionStorage(nextState) {
        const storageAreas = getExtensionStorageAreas();

        for (const storage of storageAreas) {
            try {
                await storage.set(STORAGE_KEY, nextState);
            } catch (error) {
                // localStorage already handled the non-extension fallback path.
            }
        }
    }

    function getExtensionStorageAreas() {
        const storageAreas = [];
        const extensionBrowser = globalThis.browser;
        const extensionChrome = globalThis.chrome;

        if (extensionBrowser && extensionBrowser.storage) {
            if (extensionBrowser.storage.sync) {
                storageAreas.push(createPromiseStorageArea(extensionBrowser.storage.sync));
            }

            if (extensionBrowser.storage.local) {
                storageAreas.push(createPromiseStorageArea(extensionBrowser.storage.local));
            }

            return storageAreas;
        }

        if (extensionChrome && extensionChrome.storage) {
            if (extensionChrome.storage.sync) {
                storageAreas.push(createCallbackStorageArea(extensionChrome.storage.sync, extensionChrome));
            }

            if (extensionChrome.storage.local) {
                storageAreas.push(createCallbackStorageArea(extensionChrome.storage.local, extensionChrome));
            }
        }

        return storageAreas;
    }

    function createPromiseStorageArea(area) {
        return {
            get: async (key) => {
                const result = await area.get(key);
                return result ? result[key] : null;
            },
            set: async (key, value) => area.set({ [key]: value })
        };
    }

    function createCallbackStorageArea(area, extensionChrome) {
        return {
            get: (key) => new Promise((resolve) => {
                area.get(key, (result) => {
                    if (extensionChrome.runtime && extensionChrome.runtime.lastError) {
                        resolve(null);
                        return;
                    }

                    resolve(result ? result[key] : null);
                });
            }),
            set: (key, value) => new Promise((resolve, reject) => {
                area.set({ [key]: value }, () => {
                    if (extensionChrome.runtime && extensionChrome.runtime.lastError) {
                        reject(extensionChrome.runtime.lastError);
                        return;
                    }

                    resolve();
                });
            })
        };
    }

    function registerExternalStateListeners() {
        if (isListeningForExternalState) {
            return;
        }

        isListeningForExternalState = true;
        registerExtensionStorageChangeListener();
        window.addEventListener('storage', handleLocalStorageChange);
    }

    function registerExtensionStorageChangeListener() {
        const extensionBrowser = globalThis.browser;
        const extensionChrome = globalThis.chrome;

        if (extensionBrowser && extensionBrowser.storage && extensionBrowser.storage.onChanged) {
            extensionBrowser.storage.onChanged.addListener(handleExtensionStorageChange);
            return;
        }

        if (extensionChrome && extensionChrome.storage && extensionChrome.storage.onChanged) {
            extensionChrome.storage.onChanged.addListener(handleExtensionStorageChange);
        }
    }

    function handleExtensionStorageChange(changes, areaName) {
        if (areaName !== 'sync' && areaName !== 'local') {
            return;
        }

        const change = changes && changes[STORAGE_KEY];

        if (!change || !Object.prototype.hasOwnProperty.call(change, 'newValue')) {
            return;
        }

        applyExternalState(change.newValue || {});
    }

    function handleLocalStorageChange(event) {
        if (event.key !== STORAGE_KEY) {
            return;
        }

        try {
            applyExternalState(event.newValue ? JSON.parse(event.newValue) : {});
        } catch (error) {
            applyExternalState({});
        }
    }

    function applyExternalState(rawState) {
        const nextState = normalizeState(rawState);

        if (statesEqual(state, nextState)) {
            return;
        }

        state = nextState;
        applyState();
        updateControls();
    }

    function statesEqual(leftState, rightState) {
        return Object.keys(DEFAULT_STATE).every((key) => leftState[key] === rightState[key]);
    }

    function normalizeState(rawState) {
        const nextState = { ...DEFAULT_STATE };

        if (!rawState || typeof rawState !== 'object') {
            return nextState;
        }

        nextState.contrast = normalizeOption(rawState.contrast, ['normal', ...CONTRAST_LEVELS], 'normal');
        nextState.highlightLinks = Boolean(rawState.highlightLinks);
        nextState.invert = Boolean(rawState.invert);
        nextState.saturation = normalizeLegacyOption(rawState.saturation, SATURATION_LEVELS, 'default', 'high');
        nextState.fontLevel = clampFontLevel(Number(rawState.fontLevel) || 0);
        nextState.textSpacing = normalizeLegacyOption(rawState.textSpacing, TEXT_SPACING_LEVELS, 'default', 'medium');
        nextState.lineHeight = normalizeLegacyOption(rawState.lineHeight, LINE_HEIGHT_LEVELS, 'default', '2em');
        nextState.hideImages = Boolean(rawState.hideImages);
        nextState.bigCursor = Boolean(rawState.bigCursor || rawState.biggerCursor);
        nextState.pauseAnimations = Boolean(rawState.pauseAnimations);
        nextState.dyslexiaFont = Boolean(rawState.dyslexiaFont);
        nextState.fontFamily = normalizeOption(rawState.fontFamily || rawState.fontSelection, ['default', ...FONT_FAMILIES], 'default');
        nextState.colorFilter = normalizeOption(rawState.colorFilter, ['default', ...COLOR_FILTERS], 'default');
        nextState.textAlign = normalizeOption(rawState.textAlign, ['default', ...TEXT_ALIGNMENTS], 'default');

        return nextState;
    }

    function normalizeLegacyOption(value, options, defaultValue, legacyTrueValue) {
        if (typeof value === 'boolean') {
            return value ? legacyTrueValue : defaultValue;
        }

        return normalizeOption(value, [defaultValue, ...options], defaultValue);
    }

    function normalizeOption(value, options, defaultValue) {
        return options.includes(value) ? value : defaultValue;
    }

    function clampFontLevel(level) {
        const roundedLevel = Math.round(level);
        return Math.max(FONT_LEVELS[0], Math.min(FONT_LEVELS[FONT_LEVELS.length - 1], roundedLevel));
    }

    function createWidget() {
        trigger = findOrCreateInlineTrigger();

        root = document.createElement('div');
        root.id = 'linkumoriA11yTools';
        root.className = 'linkumori-a11y-layer';
        root.innerHTML = buildWidgetMarkup();
        document.body.appendChild(root);

        modal = root.querySelector('#linkumoriA11yModal');
        backdrop = root.querySelector('#linkumoriA11yBackdrop');
        liveRegion = root.querySelector('#linkumoriA11yLiveRegion');
        bigCursor = root.querySelector('#linkumoriA11yCursor');

        configureTrigger(trigger);
        trigger.addEventListener('click', openModal);
        backdrop.addEventListener('click', closeModal);
        root.querySelector('#linkumoriA11yClose').addEventListener('click', closeModal);
        root.querySelector('#linkumoriA11yReset').addEventListener('click', resetAccessibilitySettings);
        root.addEventListener('click', handleToolClick);
        document.addEventListener('keydown', handleDocumentKeydown);
    }

    function findOrCreateInlineTrigger() {
        const existingTrigger = document.querySelector('[data-linkumori-a11y-trigger]');

        if (existingTrigger) {
            return existingTrigger;
        }

        const inlineTrigger = document.createElement('button');
        inlineTrigger.type = 'button';
        inlineTrigger.id = 'linkumoriA11yTrigger';
        inlineTrigger.className = 'linkumori-a11y-inline-trigger';
        inlineTrigger.setAttribute('data-linkumori-a11y-trigger', '');

        const target = findInlineTriggerTarget();

        if (target && target.mode === 'before') {
            target.element.parentElement.insertBefore(inlineTrigger, target.element);
            return inlineTrigger;
        }

        if (target && target.mode === 'append') {
            target.element.appendChild(inlineTrigger);
            return inlineTrigger;
        }

        if (target && target.mode === 'prepend') {
            target.element.insertBefore(inlineTrigger, target.element.firstChild);
            return inlineTrigger;
        }

        document.body.insertBefore(inlineTrigger, document.body.firstChild);
        return inlineTrigger;
    }

    function findInlineTriggerTarget() {
        const actionContainer = document.querySelector('.header-actions, .header-buttons');

        if (actionContainer) {
            return { element: actionContainer, mode: 'append' };
        }

        const themeToggle = document.querySelector('.header #themeToggle, .header .theme-toggle-btn, header #themeToggle, header .theme-toggle-btn');

        if (themeToggle && themeToggle.parentElement) {
            return { element: themeToggle, mode: 'before' };
        }

        const header = document.querySelector('.header, header');

        if (header) {
            return { element: header, mode: 'append' };
        }

        const mainContent = document.querySelector('main#main-content, main');

        if (mainContent) {
            return { element: mainContent, mode: 'prepend' };
        }

        return null;
    }

    function configureTrigger(button) {
        if (!button.id) {
            button.id = 'linkumoriA11yTrigger';
        }

        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'linkumoriA11yModal');

        if (!button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', translate('accessibility_tools_title', 'Accessibility Tools'));
        }

        if (!button.getAttribute('title')) {
            button.setAttribute('title', translate('accessibility_tools_title', 'Accessibility Tools'));
        }

        if (!button.textContent.trim() && !button.querySelector('svg, img')) {
            button.innerHTML = `
                <span class="linkumori-a11y-visually-hidden">${escapeHtml(translate('accessibility_tools_open', 'Open Accessibility Tools'))}</span>
                ${ICONS.accessibility}
            `;
        }
    }

    function buildWidgetMarkup() {
        return `
            ${buildFilterDefinitions()}
            <div id="linkumoriA11yBackdrop" class="linkumori-a11y-backdrop" hidden></div>
            <section id="linkumoriA11yModal" class="linkumori-a11y-modal" role="dialog" aria-modal="true" aria-labelledby="linkumoriA11yTitle" tabindex="-1" hidden>
                <div class="linkumori-a11y-modal-header">
                    <button type="button" id="linkumoriA11yReset" class="linkumori-a11y-reset" aria-label="${escapeHtml(translate('accessibility_tools_reset_all_settings', 'Reset All Accessibility Settings'))}" title="${escapeHtml(translate('button_reset', 'Reset'))}">
                        ${ICONS.reset}
                    </button>
                    <h2 id="linkumoriA11yTitle">${escapeHtml(translate('accessibility_tools_title', 'Accessibility Tools'))}</h2>
                    <button type="button" id="linkumoriA11yClose" class="linkumori-a11y-close" aria-label="${escapeHtml(translate('accessibility_tools_close', 'Close Accessibility Tools'))}" title="${escapeHtml(translate('button_close', 'Close'))}">
                        ${ICONS.close}
                    </button>
                </div>
                <div class="linkumori-a11y-modal-body">
                    ${TOOL_GROUPS.map(buildGroupMarkup).join('')}
                </div>
            </section>
            <div id="linkumoriA11yLiveRegion" class="linkumori-a11y-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
            <div id="linkumoriA11yCursor" class="linkumori-a11y-cursor" aria-hidden="true" hidden>${ICONS.cursorShape}</div>
        `;
    }

    function buildFilterDefinitions() {
        return `
            <svg class="linkumori-a11y-filter-defs" width="0" height="0" aria-hidden="true" focusable="false">
                <defs>
                    <filter id="linkumoriA11yProtanopiaFilter">
                        <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"></feColorMatrix>
                    </filter>
                    <filter id="linkumoriA11yDeuteranopiaFilter">
                        <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"></feColorMatrix>
                    </filter>
                    <filter id="linkumoriA11yTritanopiaFilter">
                        <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"></feColorMatrix>
                    </filter>
                </defs>
            </svg>
        `;
    }

    function buildGroupMarkup(group) {
        return `
            <div class="linkumori-a11y-group">
                <h3>${escapeHtml(getGroupTitle(group))}</h3>
                <div class="linkumori-a11y-grid">
                    ${group.tools.map(buildToolMarkup).join('')}
                </div>
            </div>
        `;
    }

    function buildToolMarkup(tool) {
        const visual = tool.textIcon
            ? `<span class="linkumori-a11y-text-icon" aria-hidden="true">${tool.textIcon}</span>`
            : tool.icon;
        const label = getToolLabel(tool);
        const status = getActionStatus(tool.action);
        const controlLabel = translate('accessibility_tools_control_status', '$1: $2', [label, status]);

        return `
            <button type="button" class="linkumori-a11y-tool" data-a11y-action="${tool.action}" aria-pressed="false" aria-label="${escapeHtml(controlLabel)}" title="${escapeHtml(controlLabel)}">
                <span class="linkumori-a11y-tool-visual">${visual}</span>
                <span class="linkumori-a11y-tool-label">${escapeHtml(label)}</span>
                <span class="linkumori-a11y-tool-status" aria-hidden="true">${escapeHtml(status)}</span>
                ${buildStepMarkup(tool.steps || 0)}
            </button>
        `;
    }

    function buildStepMarkup(stepCount) {
        if (!stepCount) {
            return '';
        }

        return `
            <span class="linkumori-a11y-steps" aria-hidden="true">
                ${Array.from({ length: stepCount }, () => '<span class="linkumori-a11y-step"></span>').join('')}
            </span>
        `;
    }

    function handleToolClick(event) {
        const button = event.target.closest('[data-a11y-action]');

        if (!button || !root.contains(button) || button.disabled) {
            return;
        }

        event.preventDefault();
        performAction(button.dataset.a11yAction);
    }

    function performAction(action) {
        switch (action) {
            case 'contrast-cycle':
                state.contrast = cycleOption(state.contrast, CONTRAST_LEVELS, 'normal');
                announceActionValue(action, 'contrast', state.contrast);
                break;
            case 'color-filter':
                state.colorFilter = cycleOption(state.colorFilter, COLOR_FILTERS, 'default');
                announceActionValue(action, 'colorFilter', state.colorFilter);
                break;
            case 'highlight-links':
                state.highlightLinks = !state.highlightLinks;
                announceToggle(getActionLabel(action), state.highlightLinks);
                break;
            case 'invert':
                state.invert = !state.invert;
                announceToggle(getActionLabel(action), state.invert);
                break;
            case 'saturation':
                state.saturation = cycleOption(state.saturation, SATURATION_LEVELS, 'default');
                announceActionValue(action, 'saturation', state.saturation);
                break;
            case 'font-increase':
                state.fontLevel = clampFontLevel(state.fontLevel + 1);
                announceActionValue(action, 'fontLevel', state.fontLevel);
                break;
            case 'font-decrease':
                state.fontLevel = clampFontLevel(state.fontLevel - 1);
                announceActionValue(action, 'fontLevel', state.fontLevel);
                break;
            case 'font-normal':
                state.fontLevel = 0;
                announce(translate('accessibility_tools_default_text_size_selected', 'Default Text Size selected'));
                break;
            case 'font-selection':
                state.fontFamily = cycleOption(state.fontFamily, FONT_FAMILIES, 'default');
                announceActionValue(action, 'fontFamily', state.fontFamily);
                break;
            case 'dyslexia-font':
                state.dyslexiaFont = !state.dyslexiaFont;
                announceToggle(getActionLabel(action), state.dyslexiaFont);
                break;
            case 'text-spacing':
                state.textSpacing = cycleOption(state.textSpacing, TEXT_SPACING_LEVELS, 'default');
                announceActionValue(action, 'textSpacing', state.textSpacing);
                break;
            case 'line-height':
                state.lineHeight = cycleOption(state.lineHeight, LINE_HEIGHT_LEVELS, 'default');
                announceActionValue(action, 'lineHeight', state.lineHeight);
                break;
            case 'text-align':
                state.textAlign = cycleOption(state.textAlign, TEXT_ALIGNMENTS, 'default');
                announceActionValue(action, 'textAlign', state.textAlign);
                break;
            case 'hide-images':
                state.hideImages = !state.hideImages;
                announceToggle(getActionLabel(action), state.hideImages);
                break;
            case 'pause-animations':
                state.pauseAnimations = !state.pauseAnimations;
                announceToggle(getActionLabel(action), state.pauseAnimations);
                break;
            case 'big-cursor':
                state.bigCursor = !state.bigCursor;
                announceToggle(getActionLabel(action), state.bigCursor);
                break;
            case 'reset':
                resetAccessibilitySettings();
                return;
            default:
                return;
        }

        applyState();
        updateControls();
        void saveState();
    }

    function resetAccessibilitySettings() {
        state = { ...DEFAULT_STATE };
        announce(translate('accessibility_tools_reset_announcement', 'All accessibility settings reset'));
        applyState();
        updateControls();
        void saveState();
    }

    function cycleOption(currentValue, options, defaultValue) {
        const currentIndex = options.indexOf(currentValue);

        if (currentIndex === -1) {
            return options[0];
        }

        if (currentIndex === options.length - 1) {
            return defaultValue;
        }

        return options[currentIndex + 1];
    }

    function announceActionValue(action, group, value) {
        announce(translate(
            'accessibility_tools_control_status',
            '$1: $2',
            [getActionLabel(action), getValueLabel(group, value)]
        ));
    }

    function announceToggle(label, isEnabled) {
        announce(translate(
            'accessibility_tools_toggle_announcement',
            '$1 $2',
            [label, isEnabled ? translate('accessibility_tools_enabled', 'enabled') : translate('accessibility_tools_disabled', 'disabled')]
        ));
    }

    function announce(message) {
        if (liveRegion) {
            liveRegion.textContent = '';
            window.requestAnimationFrame(() => {
                liveRegion.textContent = message;
            });
        }
    }

    function applyState() {
        const html = document.documentElement;
        const body = document.body;

        if (!body) {
            return;
        }

        html.classList.toggle('linkumori-a11y-high-contrast', state.contrast === 'high' || state.contrast === 'ultra');
        body.classList.toggle('linkumori-a11y-high-contrast', state.contrast === 'high' || state.contrast === 'ultra');
        body.classList.toggle('linkumori-a11y-highlight-links', state.highlightLinks);
        body.classList.toggle('linkumori-a11y-text-spacing', state.textSpacing !== 'default');
        body.classList.toggle('linkumori-a11y-line-height', state.lineHeight !== 'default');
        body.classList.toggle('linkumori-a11y-hide-images', state.hideImages);
        body.classList.toggle('linkumori-a11y-pause-animations', state.pauseAnimations);
        body.classList.toggle('linkumori-a11y-dyslexia-font', state.dyslexiaFont);
        html.classList.toggle('linkumori-a11y-big-cursor', state.bigCursor);
        body.classList.toggle('linkumori-a11y-big-cursor', state.bigCursor);

        applyValueClass(body, 'linkumori-a11y-contrast-', CONTRAST_LEVELS, state.contrast);
        applyValueClass(body, 'linkumori-a11y-text-spacing-', TEXT_SPACING_LEVELS, state.textSpacing);
        applyValueClass(body, 'linkumori-a11y-line-height-', LINE_HEIGHT_LEVELS, state.lineHeight);
        applyValueClass(body, 'linkumori-a11y-font-', FONT_FAMILIES, state.fontFamily);
        applyValueClass(body, 'linkumori-a11y-text-align-', TEXT_ALIGNMENTS, state.textAlign);
        applyValueClass(html, 'linkumori-a11y-filter-', COLOR_FILTERS, state.colorFilter);
        applyValueClass(html, 'linkumori-a11y-saturation-', SATURATION_LEVELS, state.saturation);

        applyFontLevel(body);
        applyFilters(body);
        updateBigCursorTracking();
    }

    function applyValueClass(element, prefix, options, currentValue) {
        options.forEach((option) => {
            element.classList.toggle(`${prefix}${option}`, currentValue === option);
        });
    }

    function applyFontLevel(body) {
        body.classList.remove(
            'linkumori-a11y-font-xsmall',
            'linkumori-a11y-font-small',
            'linkumori-a11y-font-large',
            'linkumori-a11y-font-xlarge',
            'linkumori-a11y-font-xxlarge'
        );

        const classByLevel = {
            '-2': 'linkumori-a11y-font-xsmall',
            '-1': 'linkumori-a11y-font-small',
            1: 'linkumori-a11y-font-large',
            2: 'linkumori-a11y-font-xlarge',
            3: 'linkumori-a11y-font-xxlarge'
        };

        const fontClass = classByLevel[state.fontLevel];

        if (fontClass) {
            body.classList.add(fontClass);
        }
    }

    function applyFilters(body) {
        const filters = [];

        if (state.contrast === 'medium') {
            filters.push('contrast(1.35)');
        } else if (state.contrast === 'ultra') {
            filters.push('contrast(1.8)');
        }

        if (state.invert) {
            filters.push('invert(1) hue-rotate(180deg)');
        }

        const colorFilter = getColorFilterValue(state.colorFilter);
        if (colorFilter) {
            filters.push(colorFilter);
        }

        const saturationFilter = getSaturationFilterValue(state.saturation);
        if (saturationFilter) {
            filters.push(saturationFilter);
        }

        body.classList.toggle('linkumori-a11y-filtered', filters.length > 0);
        body.style.setProperty('--linkumori-a11y-page-filter', filters.length ? filters.join(' ') : 'none');
    }

    function getColorFilterValue(colorFilter) {
        switch (colorFilter) {
            case 'protanopia':
                return 'url("#linkumoriA11yProtanopiaFilter")';
            case 'deuteranopia':
                return 'url("#linkumoriA11yDeuteranopiaFilter")';
            case 'tritanopia':
                return 'url("#linkumoriA11yTritanopiaFilter")';
            case 'grayscale':
                return 'grayscale(1)';
            default:
                return '';
        }
    }

    function getSaturationFilterValue(saturation) {
        switch (saturation) {
            case 'low':
                return 'saturate(0.55)';
            case 'high':
                return 'saturate(2)';
            case 'none':
                return 'grayscale(1) saturate(0)';
            default:
                return '';
        }
    }

    function updateControls() {
        if (!root) {
            return;
        }

        TOOL_GROUPS.forEach((group) => {
            group.tools.forEach(updateToolControl);
        });
    }

    function updateToolControl(tool) {
        const button = root.querySelector(`[data-a11y-action="${tool.action}"]`);

        if (!button) {
            return;
        }

        const status = getActionStatus(tool.action);
        const isActive = isActionActive(tool.action);
        const label = getToolLabel(tool);
        const controlLabel = translate('accessibility_tools_control_status', '$1: $2', [label, status]);

        button.setAttribute('aria-pressed', String(isActive));
        button.setAttribute('aria-label', controlLabel);
        button.title = controlLabel;

        const statusElement = button.querySelector('.linkumori-a11y-tool-status');
        if (statusElement) {
            statusElement.textContent = status;
        }

        updateStepIndicators(button, getActionStepIndex(tool.action));
    }

    function updateStepIndicators(button, activeStepCount) {
        const steps = button.querySelectorAll('.linkumori-a11y-step');

        steps.forEach((step, index) => {
            step.classList.toggle('active', index < activeStepCount);
        });
    }

    function isActionActive(action) {
        switch (action) {
            case 'contrast-cycle':
                return state.contrast !== 'normal';
            case 'color-filter':
                return state.colorFilter !== 'default';
            case 'highlight-links':
                return state.highlightLinks;
            case 'invert':
                return state.invert;
            case 'saturation':
                return state.saturation !== 'default';
            case 'font-increase':
                return state.fontLevel > 0;
            case 'font-decrease':
                return state.fontLevel < 0;
            case 'font-normal':
                return state.fontLevel === 0;
            case 'font-selection':
                return state.fontFamily !== 'default';
            case 'dyslexia-font':
                return state.dyslexiaFont;
            case 'text-spacing':
                return state.textSpacing !== 'default';
            case 'line-height':
                return state.lineHeight !== 'default';
            case 'text-align':
                return state.textAlign !== 'default';
            case 'hide-images':
                return state.hideImages;
            case 'pause-animations':
                return state.pauseAnimations;
            case 'big-cursor':
                return state.bigCursor;
            default:
                return false;
        }
    }

    function getActionStatus(action) {
        switch (action) {
            case 'contrast-cycle':
                return getValueLabel('contrast', state.contrast);
            case 'color-filter':
                return getValueLabel('colorFilter', state.colorFilter);
            case 'highlight-links':
                return getToggleLabel(state.highlightLinks);
            case 'invert':
                return getToggleLabel(state.invert);
            case 'saturation':
                return getValueLabel('saturation', state.saturation);
            case 'font-increase':
            case 'font-decrease':
            case 'font-normal':
                return getValueLabel('fontLevel', state.fontLevel);
            case 'font-selection':
                return getValueLabel('fontFamily', state.fontFamily);
            case 'dyslexia-font':
                return getToggleLabel(state.dyslexiaFont);
            case 'text-spacing':
                return getValueLabel('textSpacing', state.textSpacing);
            case 'line-height':
                return getValueLabel('lineHeight', state.lineHeight);
            case 'text-align':
                return getValueLabel('textAlign', state.textAlign);
            case 'hide-images':
                return getToggleLabel(state.hideImages);
            case 'pause-animations':
                return getToggleLabel(state.pauseAnimations);
            case 'big-cursor':
                return getToggleLabel(state.bigCursor);
            default:
                return '';
        }
    }

    function getActionStepIndex(action) {
        switch (action) {
            case 'contrast-cycle':
                return getOptionStepIndex(state.contrast, CONTRAST_LEVELS);
            case 'color-filter':
                return getOptionStepIndex(state.colorFilter, COLOR_FILTERS);
            case 'saturation':
                return getOptionStepIndex(state.saturation, SATURATION_LEVELS);
            case 'font-selection':
                return getOptionStepIndex(state.fontFamily, FONT_FAMILIES);
            case 'text-spacing':
                return getOptionStepIndex(state.textSpacing, TEXT_SPACING_LEVELS);
            case 'line-height':
                return getOptionStepIndex(state.lineHeight, LINE_HEIGHT_LEVELS);
            case 'text-align':
                return getOptionStepIndex(state.textAlign, TEXT_ALIGNMENTS);
            default:
                return 0;
        }
    }

    function getOptionStepIndex(value, options) {
        const index = options.indexOf(value);
        return index === -1 ? 0 : index + 1;
    }

    function getValueLabel(group, value) {
        const labels = VALUE_LABELS[group] || {};
        const label = labels[value];

        if (label) {
            return translate(label.key, label.fallback);
        }

        return String(value);
    }

    function getToggleLabel(isEnabled) {
        return isEnabled
            ? translate('accessibility_tools_value_on', 'On')
            : translate('accessibility_tools_value_off', 'Off');
    }

    function getActionLabel(action) {
        const tool = findToolByAction(action);
        return tool ? getToolLabel(tool) : action;
    }

    function findToolByAction(action) {
        for (const group of TOOL_GROUPS) {
            const tool = group.tools.find((candidate) => candidate.action === action);

            if (tool) {
                return tool;
            }
        }

        return null;
    }

    function openModal() {
        if (isModalOpen) {
            return;
        }

        lastFocusedElement = document.activeElement;
        isModalOpen = true;
        backdrop.hidden = false;
        modal.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        modal.focus({ preventScroll: true });
    }

    function closeModal() {
        if (!isModalOpen) {
            return;
        }

        isModalOpen = false;
        backdrop.hidden = true;
        modal.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus({ preventScroll: true });
        } else {
            trigger.focus({ preventScroll: true });
        }
    }

    function handleDocumentKeydown(event) {
        if (!isModalOpen) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        trapFocus(event);
    }

    function trapFocus(event) {
        const focusableElements = Array.from(modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.offsetParent !== null);

        if (!focusableElements.length) {
            event.preventDefault();
            modal.focus({ preventScroll: true });
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function updateBigCursorTracking() {
        if (!bigCursor) {
            return;
        }

        if (state.bigCursor && !isTrackingCursor) {
            document.addEventListener('mousemove', updateBigCursor, true);
            document.addEventListener('mouseleave', hideBigCursor, true);
            isTrackingCursor = true;
            return;
        }

        if (!state.bigCursor && isTrackingCursor) {
            document.removeEventListener('mousemove', updateBigCursor, true);
            document.removeEventListener('mouseleave', hideBigCursor, true);
            isTrackingCursor = false;
            hideBigCursor();
        }
    }

    function updateBigCursor(event) {
        if (!state.bigCursor || !bigCursor) {
            return;
        }

        bigCursor.hidden = false;
        bigCursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    }

    function hideBigCursor() {
        if (bigCursor) {
            bigCursor.hidden = true;
        }
    }

    ready(init);
}());
