/*
 * Linkumori shared accessibility tools.
 *
 * Copyright (c) 2026 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *  * 2026-08-09   Subham Mahesh   Added shared accessibility tools.

 */
(function () {
    'use strict';

    const STORAGE_KEY = 'linkumori_accessibility_tools_v1';
    const FONT_LEVELS = [-2, -1, 0, 1, 2, 3];
    const DEFAULT_STATE = Object.freeze({
        contrast: 'normal',
        highlightLinks: false,
        invert: false,
        saturation: false,
        fontLevel: 0,
        textSpacing: false,
        lineHeight: false,
        hideImages: false,
        bigCursor: false
    });

    const ICONS = Object.freeze({
        accessibility: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.25" r="2.25"></circle><path d="M4 8.25h16"></path><path d="M12 6.75v6.25"></path><path d="M8.25 20l3.75-7 3.75 7"></path></svg>',
        contrast: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M12 8v8"></path><path d="M12 8a4 4 0 0 1 0 8"></path></svg>',
        link: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 14.5 14.5 9.5"></path><path d="M8.5 9h-1a4 4 0 0 0 0 8h4a4 4 0 0 0 3.75-2.62"></path><path d="M15.5 15h1a4 4 0 0 0 0-8h-4a4 4 0 0 0-3.75 2.62"></path></svg>',
        invert: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7"></circle><path d="M12 5v14"></path></svg>',
        saturation: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3c4 4.5 6 7.75 6 10.25A6 6 0 0 1 6 13.25C6 10.75 8 7.5 12 3z"></path><path d="M12 3v16"></path></svg>',
        textSpacing: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h10"></path><path d="M12 5v12"></path><path d="M9 17h6"></path><path d="M4 19h16"></path><path d="M6 17 4 19l2 2"></path><path d="M18 17l2 2-2 2"></path></svg>',
        lineHeight: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h8"></path><path d="M8 12h8"></path><path d="M8 19h8"></path><path d="M4 6v12"></path><path d="m2.5 8 1.5-2 1.5 2"></path><path d="m2.5 16 1.5 2 1.5-2"></path></svg>',
        hideImages: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="m4 4 16 16"></path><path d="m7 16 3-3 2 2 1.25-1.25"></path><circle cx="16" cy="9" r="1.5"></circle></svg>',
        cursor: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 3 6 17 2.25-6.25L19.5 11 5 3z"></path><path d="M15 3v3"></path><path d="M18.5 4.5 16.4 6.6"></path><path d="M20 8h-3"></path></svg>',
        close: '<svg class="linkumori-a11y-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>',
        cursorShape: '<svg viewBox="0 0 38 38" aria-hidden="true" focusable="false"><path d="M6 3v28l8.4-7.1 4.6 10.3 5.3-2.4-4.7-10.1 11.1-.8L6 3z"></path></svg>'
    });

    const TOOL_GROUPS = Object.freeze([
        {
            title: 'Color Contrast',
            tools: [
                { action: 'contrast-high', label: 'High Contrast', icon: ICONS.contrast },
                { action: 'contrast-normal', label: 'Normal Contrast', icon: ICONS.contrast },
                { action: 'highlight-links', label: 'Highlight Links', icon: ICONS.link },
                { action: 'invert', label: 'Invert', icon: ICONS.invert },
                { action: 'saturation', label: 'Saturation', icon: ICONS.saturation }
            ]
        },
        {
            title: 'Text Size',
            tools: [
                { action: 'font-increase', label: 'Font Size Increase', textIcon: 'A+' },
                { action: 'font-decrease', label: 'Font Size Decrease', textIcon: 'A-' },
                { action: 'font-normal', label: 'Normal Font', textIcon: 'A' },
                { action: 'text-spacing', label: 'Text Spacing', icon: ICONS.textSpacing },
                { action: 'line-height', label: 'Line Height', icon: ICONS.lineHeight }
            ]
        },
        {
            title: 'Others',
            tools: [
                { action: 'hide-images', label: 'Hide Images', icon: ICONS.hideImages },
                { action: 'big-cursor', label: 'Big Cursor', icon: ICONS.cursor }
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
        createWidget();
        registerExternalStateListeners();
        applyState();
        updateControls();
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

        nextState.contrast = rawState.contrast === 'high' ? 'high' : 'normal';
        nextState.highlightLinks = Boolean(rawState.highlightLinks);
        nextState.invert = Boolean(rawState.invert);
        nextState.saturation = Boolean(rawState.saturation);
        nextState.fontLevel = clampFontLevel(Number(rawState.fontLevel) || 0);
        nextState.textSpacing = Boolean(rawState.textSpacing);
        nextState.lineHeight = Boolean(rawState.lineHeight);
        nextState.hideImages = Boolean(rawState.hideImages);
        nextState.bigCursor = Boolean(rawState.bigCursor);

        return nextState;
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
            button.setAttribute('aria-label', 'Accessibility Tools');
        }

        if (!button.getAttribute('title')) {
            button.setAttribute('title', 'Accessibility Tools');
        }

        if (!button.textContent.trim() && !button.querySelector('svg, img')) {
            button.innerHTML = `
                <span class="linkumori-a11y-visually-hidden">Open Accessibility Tools</span>
                ${ICONS.accessibility}
            `;
        }
    }

    function buildWidgetMarkup() {
        return `
            <div id="linkumoriA11yBackdrop" class="linkumori-a11y-backdrop" hidden></div>
            <section id="linkumoriA11yModal" class="linkumori-a11y-modal" role="dialog" aria-modal="true" aria-labelledby="linkumoriA11yTitle" tabindex="-1" hidden>
                <div class="linkumori-a11y-modal-header">
                    <h2 id="linkumoriA11yTitle">Accessibility Tools</h2>
                    <button type="button" id="linkumoriA11yClose" class="linkumori-a11y-close" aria-label="Close Accessibility Tools" title="Close">
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

    function buildGroupMarkup(group) {
        return `
            <div class="linkumori-a11y-group">
                <h3>${group.title}</h3>
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

        return `
            <button type="button" class="linkumori-a11y-tool" data-a11y-action="${tool.action}" aria-pressed="false" title="${tool.label}">
                <span class="linkumori-a11y-tool-visual">${visual}</span>
                <span class="linkumori-a11y-tool-label">${tool.label}</span>
            </button>
        `;
    }

    function handleToolClick(event) {
        const button = event.target.closest('[data-a11y-action]');

        if (!button || !root.contains(button)) {
            return;
        }

        event.preventDefault();
        performAction(button.dataset.a11yAction);
    }

    function performAction(action) {
        switch (action) {
            case 'contrast-high':
                state.contrast = 'high';
                announce('High Contrast selected');
                break;
            case 'contrast-normal':
                state.contrast = 'normal';
                announce('Normal Contrast selected');
                break;
            case 'highlight-links':
                state.highlightLinks = !state.highlightLinks;
                announceToggle('Highlight Links', state.highlightLinks);
                break;
            case 'invert':
                state.invert = !state.invert;
                announceToggle('Invert', state.invert);
                break;
            case 'saturation':
                state.saturation = !state.saturation;
                announceToggle('Saturation', state.saturation);
                break;
            case 'font-increase':
                state.fontLevel = clampFontLevel(state.fontLevel + 1);
                announce('Font size increased');
                break;
            case 'font-decrease':
                state.fontLevel = clampFontLevel(state.fontLevel - 1);
                announce('Font size decreased');
                break;
            case 'font-normal':
                state.fontLevel = 0;
                announce('Normal Font selected');
                break;
            case 'text-spacing':
                state.textSpacing = !state.textSpacing;
                announceToggle('Text Spacing', state.textSpacing);
                break;
            case 'line-height':
                state.lineHeight = !state.lineHeight;
                announceToggle('Line Height', state.lineHeight);
                break;
            case 'hide-images':
                state.hideImages = !state.hideImages;
                announceToggle('Hide Images', state.hideImages);
                break;
            case 'big-cursor':
                state.bigCursor = !state.bigCursor;
                announceToggle('Big Cursor', state.bigCursor);
                break;
            default:
                return;
        }

        applyState();
        updateControls();
        saveState();
    }

    function announceToggle(label, isEnabled) {
        announce(`${label} ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    function announce(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    function applyState() {
        const html = document.documentElement;
        const body = document.body;

        if (!body) {
            return;
        }

        html.classList.toggle('linkumori-a11y-high-contrast', state.contrast === 'high');
        body.classList.toggle('linkumori-a11y-high-contrast', state.contrast === 'high');
        body.classList.toggle('linkumori-a11y-highlight-links', state.highlightLinks);
        body.classList.toggle('linkumori-a11y-text-spacing', state.textSpacing);
        body.classList.toggle('linkumori-a11y-line-height', state.lineHeight);
        body.classList.toggle('linkumori-a11y-hide-images', state.hideImages);
        html.classList.toggle('linkumori-a11y-big-cursor', state.bigCursor);
        body.classList.toggle('linkumori-a11y-big-cursor', state.bigCursor);

        applyFontLevel(body);
        applyFilters(body);
        updateBigCursorTracking();
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

        if (state.invert) {
            filters.push('invert(1) hue-rotate(180deg)');
        }

        if (state.saturation) {
            filters.push('saturate(1.75)');
        }

        body.classList.toggle('linkumori-a11y-filtered', filters.length > 0);
        body.style.setProperty('--linkumori-a11y-page-filter', filters.length ? filters.join(' ') : 'none');
    }

    function updateControls() {
        if (!root) {
            return;
        }

        setPressed('contrast-high', state.contrast === 'high');
        setPressed('contrast-normal', state.contrast === 'normal');
        setPressed('highlight-links', state.highlightLinks);
        setPressed('invert', state.invert);
        setPressed('saturation', state.saturation);
        setPressed('font-increase', state.fontLevel > 0);
        setPressed('font-decrease', state.fontLevel < 0);
        setPressed('font-normal', state.fontLevel === 0);
        setPressed('text-spacing', state.textSpacing);
        setPressed('line-height', state.lineHeight);
        setPressed('hide-images', state.hideImages);
        setPressed('big-cursor', state.bigCursor);
    }

    function setPressed(action, isPressed) {
        const button = root.querySelector(`[data-a11y-action="${action}"]`);

        if (!button) {
            return;
        }

        button.setAttribute('aria-pressed', String(isPressed));
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
