/*
 * ============================================================
 * Linkumori
 * ============================================================
 * Copyright (c) 2025–2026 Subham Mahesh
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
 * MODIFICATIONS
 * -------------
 * - Added shared modal dialog utility for alert/confirm/prompt
 *   replacement
 * - Added theme-token-based modal styling to align with page themes
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
 * 2026-01-02   Subham Mahesh   Fourth modification
 *
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
(function initLinkumoriModal(global) {
    'use strict';

    if (global.LinkumoriModal) {
        return;
    }

    const STYLE_ID = 'linkumori-modal-dialog-style';
    const ROOT_ID = 'linkumori-modal-dialog-root';
    const DEFAULT_OK = 'Confirm';
    const DEFAULT_CANCEL = 'Cancel';
    const DEFAULT_ALERT_TITLE = 'Notice';
    const DEFAULT_CONFIRM_TITLE = 'Confirm';
    const DEFAULT_PROMPT_TITLE = 'Input Required';

    function getMessage(key, fallback) {
        try {
            if (global.LinkumoriI18n && typeof global.LinkumoriI18n.getMessage === 'function') {
                const translated = global.LinkumoriI18n.getMessage(key);
                if (translated && translated !== key) return translated;
            }
        } catch (error) {
            // Fallback to default labels.
        }
        return fallback;
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 100000;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(4px);
                padding: 16px;
            }
            #${ROOT_ID}.show {
                display: flex;
            }
            #${ROOT_ID} .lkm-dialog {
                width: min(520px, 92vw);
                background: var(--bg-secondary, #1e293b);
                color: var(--text-primary, #f8fafc);
                font-family: "Old-Country-Nobility", serif;
                border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
                border-radius: 12px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
                overflow: hidden;
            }
            #${ROOT_ID} .lkm-dialog-header {
                padding: 14px 16px;
                border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
                background: var(--bg-tertiary, #334155);
            }
            #${ROOT_ID} .lkm-dialog-title {
                margin: 0;
                font-size: 16px;
                color: var(--text-primary, #f8fafc);
            }
            #${ROOT_ID} .lkm-dialog-body {
                padding: 16px;
            }
            #${ROOT_ID} .lkm-dialog-message {
                margin: 0;
                color: var(--text-primary, #f8fafc);
                white-space: pre-wrap;
                line-height: 1.5;
            }
            #${ROOT_ID} .lkm-dialog-input {
                margin-top: 12px;
                width: 100%;
                padding: 9px 10px;
                border-radius: 8px;
                border: 1px solid var(--input-border, rgba(255, 255, 255, 0.2));
                background: var(--input-bg, rgba(255, 255, 255, 0.06));
                color: var(--text-primary, #f8fafc);
                font-family: "Old-Country-Nobility", serif;
                font-size: inherit;
            }
            #${ROOT_ID} .lkm-dialog-actions {
                padding: 12px 16px 16px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            #${ROOT_ID} .lkm-dialog-btn {
                border: none;
                border-radius: 8px;
                padding: 8px 14px;
                font-family: "Old-Country-Nobility", serif;
                font-size: inherit;
                cursor: pointer;
            }
            #${ROOT_ID} .lkm-dialog-btn-cancel {
                background: var(--button-secondary, #6b7280);
                color: #ffffff;
            }
            #${ROOT_ID} .lkm-dialog-btn-confirm {
                background: var(--button-primary, #2563eb);
                color: #ffffff;
            }
            #${ROOT_ID} .lkm-dialog-btn-cancel:hover {
                background: var(--button-secondary-hover, #4b5563);
            }
            #${ROOT_ID} .lkm-dialog-btn-confirm:hover {
                background: var(--button-hover, #3b82f6);
            }
        `;

        document.head.appendChild(style);
    }

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.style.display = 'none';
            document.body.appendChild(root);
        }
        return root;
    }

    const queue = [];
    let active = false;

    function enqueue(type, options) {
        return new Promise((resolve) => {
            queue.push({ type, options: options || {}, resolve });
            if (!active) {
                showNext();
            }
        });
    }

    function showNext() {
        const item = queue.shift();
        if (!item) {
            active = false;
            return;
        }
        active = true;

        ensureStyles();
        const root = ensureRoot();

        const type = item.type;
        const opts = item.options || {};
        const defaultTitleKey = (
            type === 'alert'
                ? 'modal_alert_title'
                : (type === 'prompt' ? 'modal_prompt_title' : 'modal_confirm_title')
        );
        const defaultTitleFallback = (
            type === 'alert'
                ? DEFAULT_ALERT_TITLE
                : (type === 'prompt' ? DEFAULT_PROMPT_TITLE : DEFAULT_CONFIRM_TITLE)
        );
        const title = opts.title || getMessage(defaultTitleKey, defaultTitleFallback);
        const message = opts.message == null ? '' : String(opts.message);
        const defaultOkKey = type === 'alert' ? 'button_close' : 'button_confirm';
        const okText = opts.okText || getMessage(defaultOkKey, DEFAULT_OK);
        const cancelText = opts.cancelText || getMessage('button_cancel', DEFAULT_CANCEL);
        const defaultValue = opts.defaultValue == null ? '' : String(opts.defaultValue);

        const dialog = document.createElement('div');
        dialog.className = 'lkm-dialog';

        const header = document.createElement('div');
        header.className = 'lkm-dialog-header';
        const titleEl = document.createElement('h2');
        titleEl.className = 'lkm-dialog-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const body = document.createElement('div');
        body.className = 'lkm-dialog-body';
        const messageEl = document.createElement('p');
        messageEl.className = 'lkm-dialog-message';
        messageEl.textContent = message;
        body.appendChild(messageEl);

        let inputEl = null;
        if (type === 'prompt') {
            inputEl = document.createElement('input');
            inputEl.className = 'lkm-dialog-input';
            inputEl.type = 'text';
            inputEl.value = defaultValue;
            body.appendChild(inputEl);
        }

        const actions = document.createElement('div');
        actions.className = 'lkm-dialog-actions';

        let cancelBtn = null;
        if (type === 'confirm' || type === 'prompt') {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'lkm-dialog-btn lkm-dialog-btn-cancel';
            cancelBtn.textContent = cancelText;
            actions.appendChild(cancelBtn);
        }

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'lkm-dialog-btn lkm-dialog-btn-confirm';
        okBtn.textContent = okText;
        actions.appendChild(okBtn);

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(actions);

        root.replaceChildren(dialog);
        root.style.display = 'flex';
        root.classList.add('show');

        const close = (result) => {
            root.classList.remove('show');
            root.style.display = 'none';
            root.replaceChildren();
            document.removeEventListener('keydown', onKeyDown, true);
            item.resolve(result);
            showNext();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (type === 'alert') {
                    close();
                } else if (type === 'confirm') {
                    close(false);
                } else {
                    close({ confirmed: false, value: '' });
                }
            } else if (event.key === 'Enter' && type === 'prompt' && document.activeElement === inputEl) {
                close({ confirmed: true, value: inputEl.value });
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        root.onclick = (event) => {
            if (event.target !== root) return;
            if (type === 'alert') {
                close();
            } else if (type === 'confirm') {
                close(false);
            } else {
                close({ confirmed: false, value: '' });
            }
        };

        okBtn.onclick = () => {
            if (type === 'alert') {
                close();
            } else if (type === 'confirm') {
                close(true);
            } else {
                close({ confirmed: true, value: inputEl ? inputEl.value : '' });
            }
        };

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (type === 'confirm') {
                    close(false);
                } else {
                    close({ confirmed: false, value: '' });
                }
            };
        }

        setTimeout(() => {
            if (inputEl) {
                inputEl.focus();
                inputEl.select();
            } else {
                okBtn.focus();
            }
        }, 0);
    }

    global.LinkumoriModal = {
        alert(message, options = {}) {
            return enqueue('alert', { ...options, message });
        },
        confirm(message, options = {}) {
            return enqueue('confirm', { ...options, message });
        },
        prompt(message, defaultValue = '', options = {}) {
            return enqueue('prompt', { ...options, message, defaultValue });
        }
    };
})(window);
