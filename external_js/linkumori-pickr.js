/*
 * ============================================================
 * Linkumori — Pickr Integration
 * ============================================================
 *
 * THIRD-PARTY ATTRIBUTION — Pickr 1.9.1 (MIT License)
 * -------------------------------------------------------------
 * Source:     https://github.com/Simonwep/pickr
 * Copyright:  (c) 2018–2021 Simon Reinisch
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * ============================================================
 * Linkumori Modifications
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh (modified portions only)
 *
 * Modified portions are licensed under the GNU Lesser General
 * Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any
 * later version.
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
 * - Adapted for use in Linkumori
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
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
(function(global) {
    'use strict';

    // Color conversion utilities
    const ColorUtils = {
        hsvToRgb(h, s, v) {
            h = ((h % 360) + 360) % 360;
            s = Math.max(0, Math.min(100, s)) / 100;
            v = Math.max(0, Math.min(100, v)) / 100;
            
            const c = v * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = v - c;
            
            let r, g, b;
            if (h >= 0 && h < 60) {
                r = c; g = x; b = 0;
            } else if (h >= 60 && h < 120) {
                r = x; g = c; b = 0;
            } else if (h >= 120 && h < 180) {
                r = 0; g = c; b = x;
            } else if (h >= 180 && h < 240) {
                r = 0; g = x; b = c;
            } else if (h >= 240 && h < 300) {
                r = x; g = 0; b = c;
            } else {
                r = c; g = 0; b = x;
            }
            
            return [
                Math.round((r + m) * 255),
                Math.round((g + m) * 255),
                Math.round((b + m) * 255)
            ];
        },

        rgbToHsv(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            let h = 0;
            if (diff !== 0) {
                if (max === r) {
                    h = ((g - b) / diff) % 6;
                } else if (max === g) {
                    h = (b - r) / diff + 2;
                } else {
                    h = (r - g) / diff + 4;
                }
                h *= 60;
                if (h < 0) h += 360;
            }
            
            const s = max === 0 ? 0 : (diff / max) * 100;
            const v = max * 100;
            
            return [h, s, v];
        },

        parseColor(color) {
            if (!color) return null;
            
            // Handle hex colors
            if (color.startsWith('#')) {
                const hex = color.slice(1);
                if (hex.length === 6) {
                    return [
                        parseInt(hex.slice(0, 2), 16),
                        parseInt(hex.slice(2, 4), 16),
                        parseInt(hex.slice(4, 6), 16),
                        1
                    ];
                } else if (hex.length === 8) {
                    return [
                        parseInt(hex.slice(0, 2), 16),
                        parseInt(hex.slice(2, 4), 16),
                        parseInt(hex.slice(4, 6), 16),
                        parseInt(hex.slice(6, 8), 16) / 255
                    ];
                }
            }
            return null;
        },

        rgbToHex(r, g, b, a = 1) {
            const toHex = (n) => {
                const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };
            
            let hex = '#' + toHex(r) + toHex(g) + toHex(b);
            if (a < 1) {
                hex += toHex(a * 255);
            }
            return hex.toUpperCase();
        }
    };

    // Color class
    class Color {
        constructor(r = 0, g = 0, b = 0, a = 1) {
            this.r = Math.round(r);
            this.g = Math.round(g);
            this.b = Math.round(b);
            this.a = a;
        }

        static fromHsv(h, s, v, a = 1) {
            const [r, g, b] = ColorUtils.hsvToRgb(h, s, v);
            return new Color(r, g, b, a);
        }

        static fromString(colorString) {
            const rgba = ColorUtils.parseColor(colorString);
            if (rgba) {
                return new Color(rgba[0], rgba[1], rgba[2], rgba[3]);
            }
            return new Color(255, 165, 0, 1); // Default orange
        }

        toHSVA() {
            const [h, s, v] = ColorUtils.rgbToHsv(this.r, this.g, this.b);
            const result = [h, s, v, this.a];
            result.toString = () => `hsva(${h}, ${s}%, ${v}%, ${this.a})`;
            return result;
        }

        toRGBA() {
            const result = [this.r, this.g, this.b, this.a];
            result.toString = (precision = -1) => {
                if (precision >= 0) {
                    return `rgba(${this.r.toFixed(precision)}, ${this.g.toFixed(precision)}, ${this.b.toFixed(precision)}, ${this.a.toFixed(precision)})`;
                }
                return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
            };
            return result;
        }

        toHEXA() {
            const result = [];
            result.toString = () => ColorUtils.rgbToHex(this.r, this.g, this.b, this.a);
            return result;
        }

        clone() {
            return new Color(this.r, this.g, this.b, this.a);
        }
    }

    // Main LinkumoriPicker class
    class LinkumoriPicker {
        constructor(options) {
            this.options = {
                el: null,
                theme: 'nano',
                appClass: '',
                default: '#ff0000',
                components: {
                    preview: true,
                    opacity: true,
                    hue: true,
                    interaction: {
                        hex: true,
                        input: true,
                        save: true,
                        cancel: true
                    }
                },
                strings: {
                    save: 'Save',
                    cancel: 'Cancel'
                },
                ...options
            };

            this._eventListeners = {};
            this._color = Color.fromString(this.options.default);
            this._isOpen = false;
            this._currentHue = 0;
            this._currentSaturation = 100;
            this._currentValue = 100;
            this._currentAlpha = 1;

            this._init();
        }

        static create(options) {
            return new LinkumoriPicker(options);
        }

        _init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this._performInit();
                });
            } else {
                setTimeout(() => {
                    this._performInit();
                }, 0);
            }
        }

        _performInit() {
            this._triggerElement = typeof this.options.el === 'string' 
                ? document.querySelector(this.options.el) 
                : this.options.el;

            if (!this._triggerElement) {
                return;
            }

            this._createElements();
            this._bindEvents();
            this._updateFromColor();
            
            this._triggerElement.addEventListener('click', (e) => {
                e.preventDefault();
                if (this._isOpen) {
                    this.hide();
                } else {
                    this.show();
                }
            });
            
            this._triggerElement.style.setProperty('--linkumori-picker-color', this._color.toRGBA().toString());
            
            this._waitForReadyAndInit();
        }

        _createElements() {
            this._app = document.createElement('div');
            this._app.className = `linkumori-picker-app ${this.options.appClass || ''}`;
            this._app.setAttribute('data-theme', this.options.theme);
            this._app.style.position = 'fixed';
            this._app.style.zIndex = '10000';
            this._app.style.display = 'none';

            const parser = new DOMParser();
            const doc = parser.parseFromString(`<!doctype html><body>
                <div class="linkumori-picker-selection">
                    <div class="linkumori-picker-color-preview">
                        <div class="linkumori-picker-current-color"></div>
                    </div>
                    <div class="linkumori-picker-color-palette">
                        <div class="linkumori-picker-picker"></div>
                        <div class="linkumori-picker-palette" tabindex="0"></div>
                    </div>
                    <div class="linkumori-picker-color-chooser">
                        <div class="linkumori-picker-picker"></div>
                        <div class="linkumori-picker-hue linkumori-picker-slider" tabindex="0"></div>
                    </div>
                    <div class="linkumori-picker-color-opacity">
                        <div class="linkumori-picker-picker"></div>
                        <div class="linkumori-picker-opacity linkumori-picker-slider" tabindex="0"></div>
                    </div>
                </div>
                <div class="linkumori-picker-interaction">
                    <input class="linkumori-picker-result" type="text" spellcheck="false">
                    <input class="linkumori-picker-save" type="button">
                    <input class="linkumori-picker-cancel" type="button">
                </div>
            </body>`, 'text/html');
            this._app.replaceChildren(...Array.from(doc.body.childNodes));

            const saveInput = this._app.querySelector('.linkumori-picker-save');
            if (saveInput) {
                saveInput.value = this.options.strings.save;
            }
            const cancelInput = this._app.querySelector('.linkumori-picker-cancel');
            if (cancelInput) {
                cancelInput.value = this.options.strings.cancel;
            }

            document.body.appendChild(this._app);

            this._elements = {
                palette: this._app.querySelector('.linkumori-picker-palette'),
                palettePicker: this._app.querySelector('.linkumori-picker-color-palette .linkumori-picker-picker'),
                hueSlider: this._app.querySelector('.linkumori-picker-hue'),
                huePicker: this._app.querySelector('.linkumori-picker-color-chooser .linkumori-picker-picker'),
                opacitySlider: this._app.querySelector('.linkumori-picker-opacity'),
                opacityPicker: this._app.querySelector('.linkumori-picker-color-opacity .linkumori-picker-picker'),
                preview: this._app.querySelector('.linkumori-picker-current-color'),
                result: this._app.querySelector('.linkumori-picker-result'),
                save: this._app.querySelector('.linkumori-picker-save'),
                cancel: this._app.querySelector('.linkumori-picker-cancel')
            };
        }

        _waitForReadyAndInit() {
            const checkReady = () => {
                const elementsReady = this._elements.palette && 
                                    this._elements.hueSlider && 
                                    this._elements.opacitySlider &&
                                    this._elements.palette.offsetWidth > 0 &&
                                    this._elements.hueSlider.offsetWidth > 0;
                
                if (elementsReady) {
                    this._app.style.display = 'none';
                    this._app.offsetHeight;
                    this._app.style.display = '';
                    
                    this._initializeSliders();
                    this._updateFromColor();
                    
                    setTimeout(() => {
                        this._updatePickerPositions();
                        this._emit('init', this);
                    }, 50);
                } else {
                    setTimeout(checkReady, 10);
                }
            };
            checkReady();
        }

        _initializeSliders() {
            if (this._elements.palettePicker) {
                this._elements.palettePicker.style.position = 'absolute';
            }
            if (this._elements.huePicker) {
                this._elements.huePicker.style.position = 'absolute';
            }
            if (this._elements.opacityPicker) {
                this._elements.opacityPicker.style.position = 'absolute';
            }

            [this._elements.hueSlider, this._elements.opacitySlider].forEach(slider => {
                if (slider) {
                    slider.style.minHeight = '12px';
                    slider.style.cursor = 'pointer';
                }
            });

            if (this._elements.palette) {
                this._elements.palette.style.cursor = 'crosshair';
            }

            this._updateSliderBackgrounds();
        }

        _positionApp() {
            if (!this._triggerElement) return;
            
            const rect = this._triggerElement.getBoundingClientRect();
            const appRect = this._app.getBoundingClientRect();
            
            let left = rect.left;
            let top = rect.bottom + 8;

            if (left + appRect.width > window.innerWidth) {
                left = window.innerWidth - appRect.width - 10;
            }
            if (top + appRect.height > window.innerHeight) {
                top = rect.top - appRect.height - 8;
            }

            this._app.style.left = Math.max(10, left) + 'px';
            this._app.style.top = Math.max(10, top) + 'px';
        }

        _bindEvents() {
            this._bindPaletteEvents();
            this._bindHueEvents();
            this._bindOpacityEvents();
            this._bindInputEvents();
            this._bindButtonEvents();

            document.addEventListener('mousedown', (e) => {
                if (this._isOpen && !this._app.contains(e.target) && !this._triggerElement.contains(e.target)) {
                    this.hide();
                }
            });
        }

        _bindPaletteEvents() {
            const palette = this._elements.palette;
            const palettePicker = this._elements.palettePicker;
            let isDragging = false;

            const updatePalette = (e) => {
                const rect = palette.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

                this._currentSaturation = x * 100;
                this._currentValue = (1 - y) * 100;

                this._updateColor();
                this._updatePickerPosition(palettePicker, x, y, palette);
            };

            [palette, palettePicker].forEach(element => {
                if (element) {
                    element.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        updatePalette(e);
                        e.preventDefault();
                        document.body.style.userSelect = 'none';
                    });

                    element.addEventListener('touchstart', (e) => {
                        isDragging = true;
                        const touch = e.touches[0];
                        updatePalette({clientX: touch.clientX, clientY: touch.clientY});
                        e.preventDefault();
                    }, { passive: false });
                }
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updatePalette(e);
                    e.preventDefault();
                }
            });

            document.addEventListener('touchmove', (e) => {
                if (isDragging) {
                    const touch = e.touches[0];
                    updatePalette({clientX: touch.clientX, clientY: touch.clientY});
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.userSelect = '';
                    this._emit('changestop', this._color, 'palette', this);
                }
            });

            document.addEventListener('touchend', () => {
                if (isDragging) {
                    isDragging = false;
                    this._emit('changestop', this._color, 'palette', this);
                }
            });
        }

        _bindHueEvents() {
            const hueSlider = this._elements.hueSlider;
            const huePicker = this._elements.huePicker;
            let isDragging = false;

            const updateHue = (e) => {
                const rect = hueSlider.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                
                this._currentHue = x * 360;
                this._updatePaletteBackground();
                this._updateColor();
                this._updatePickerPosition(huePicker, x, 0.5, hueSlider);
            };

            [hueSlider, huePicker].forEach(element => {
                if (element) {
                    element.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        updateHue(e);
                        e.preventDefault();
                        document.body.style.userSelect = 'none';
                    });

                    element.addEventListener('touchstart', (e) => {
                        isDragging = true;
                        const touch = e.touches[0];
                        updateHue({clientX: touch.clientX, clientY: touch.clientY});
                        e.preventDefault();
                    }, { passive: false });
                }
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateHue(e);
                    e.preventDefault();
                }
            });

            document.addEventListener('touchmove', (e) => {
                if (isDragging) {
                    const touch = e.touches[0];
                    updateHue({clientX: touch.clientX, clientY: touch.clientY});
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.userSelect = '';
                    this._emit('changestop', this._color, 'hue', this);
                }
            });

            document.addEventListener('touchend', () => {
                if (isDragging) {
                    isDragging = false;
                    this._emit('changestop', this._color, 'hue', this);
                }
            });
        }

        _bindOpacityEvents() {
            const opacitySlider = this._elements.opacitySlider;
            const opacityPicker = this._elements.opacityPicker;
            let isDragging = false;

            const updateOpacity = (e) => {
                const rect = opacitySlider.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                
                this._currentAlpha = x;
                this._updateColor();
                this._updatePickerPosition(opacityPicker, x, 0.5, opacitySlider);
            };

            [opacitySlider, opacityPicker].forEach(element => {
                if (element) {
                    element.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        updateOpacity(e);
                        e.preventDefault();
                        document.body.style.userSelect = 'none';
                    });

                    element.addEventListener('touchstart', (e) => {
                        isDragging = true;
                        const touch = e.touches[0];
                        updateOpacity({clientX: touch.clientX, clientY: touch.clientY});
                        e.preventDefault();
                    }, { passive: false });
                }
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateOpacity(e);
                    e.preventDefault();
                }
            });

            document.addEventListener('touchmove', (e) => {
                if (isDragging) {
                    const touch = e.touches[0];
                    updateOpacity({clientX: touch.clientX, clientY: touch.clientY});
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.userSelect = '';
                    this._emit('changestop', this._color, 'opacity', this);
                }
            });

            document.addEventListener('touchend', () => {
                if (isDragging) {
                    isDragging = false;
                    this._emit('changestop', this._color, 'opacity', this);
                }
            });
        }

        _bindInputEvents() {
            this._elements.result.addEventListener('input', (e) => {
                const newColor = Color.fromString(e.target.value);
                if (newColor) {
                    this._color = newColor;
                    this._updateFromColor();
                    this._emit('change', this._color, 'input', this);
                }
            });
        }

        _bindButtonEvents() {
            this._elements.save.addEventListener('click', () => {
                this._emit('save', this._color);
                this.hide();
            });

            this._elements.cancel.addEventListener('click', () => {
                this._emit('cancel');
                this.hide();
            });
        }

        _updatePickerPosition(picker, x, y, container) {
            if (!picker || !container) return;
            
            if (picker.offsetWidth === 0 || picker.offsetHeight === 0) {
                setTimeout(() => this._updatePickerPosition(picker, x, y, container), 10);
                return;
            }
            
            const leftPercent = x * 100;
            const topPercent = y * 100;
            
            picker.style.left = `calc(${leftPercent}% - ${picker.offsetWidth / 2}px)`;
            picker.style.top = `calc(${topPercent}% - ${picker.offsetHeight / 2}px)`;
        }

        _updateColor() {
            this._color = Color.fromHsv(this._currentHue, this._currentSaturation, this._currentValue, this._currentAlpha);
            this._updatePreview();
            this._updateResult();
            this._updatePaletteBackground();
            this._updateSliderBackgrounds();
            this._emit('change', this._color, 'slider', this);
        }

        _updateFromColor() {
            const [h, s, v] = ColorUtils.rgbToHsv(this._color.r, this._color.g, this._color.b);
            this._currentHue = h;
            this._currentSaturation = s;
            this._currentValue = v;
            this._currentAlpha = this._color.a;

            this._updatePreview();
            this._updateResult();
            this._updatePaletteBackground();
            this._updateSliderBackgrounds();
            this._updatePickerPositions();
        }

        _updatePreview() {
            const colorString = this._color.toRGBA().toString();
            if (this._elements.preview) {
                this._elements.preview.style.setProperty('--linkumori-picker-color', colorString);
                this._elements.preview.style.backgroundColor = colorString;
            }
            
            if (this._triggerElement) {
                this._triggerElement.style.setProperty('--linkumori-picker-color', colorString);
                this._triggerElement.style.backgroundColor = colorString;
            }
        }

        _updateResult() {
            if (this._elements.result) {
                this._elements.result.value = this._color.toHEXA().toString();
            }
        }

        _updatePaletteBackground() {
            const hue = this._currentHue;
            const alpha = this._currentAlpha;
            if (this._elements.palette) {
                this._elements.palette.style.setProperty('background', `
                    linear-gradient(to top, rgba(0, 0, 0, ${alpha}), transparent),
                    linear-gradient(to left, hsla(${hue}, 100%, 50%, ${alpha}), rgba(255, 255, 255, ${alpha}))
                `, 'important');
            }
        }

        _updateSliderBackgrounds() {
            if (this._elements.hueSlider) {
                this._elements.hueSlider.style.background = `linear-gradient(to right, 
                    hsl(0, 100%, 50%), 
                    hsl(60, 100%, 50%), 
                    hsl(120, 100%, 50%), 
                    hsl(180, 100%, 50%), 
                    hsl(240, 100%, 50%), 
                    hsl(300, 100%, 50%), 
                    hsl(0, 100%, 50%)
                )`;
            }

            if (this._elements.opacitySlider) {
                const currentRgb = `rgb(${this._color.r}, ${this._color.g}, ${this._color.b})`;
                this._elements.opacitySlider.style.background = `
                    linear-gradient(to right, transparent, ${currentRgb}),
                    url("data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 2'><path fill='white' d='M1,0H2V1H1V0ZM0,1H1V2H0V1Z'/><path fill='gray' d='M0,0H1V1H0V0ZM1,1H2V2H1V1Z'/></svg>")
                `;
                this._elements.opacitySlider.style.backgroundSize = '100%, 0.25em';
            }
        }

        _updatePickerPositions() {
            setTimeout(() => {
                const paletteX = this._currentSaturation / 100;
                const paletteY = 1 - this._currentValue / 100;
                this._updatePickerPosition(this._elements.palettePicker, paletteX, paletteY, this._elements.palette);

                const hueX = this._currentHue / 360;
                this._updatePickerPosition(this._elements.huePicker, hueX, 0.5, this._elements.hueSlider);

                const opacityX = this._currentAlpha;
                this._updatePickerPosition(this._elements.opacityPicker, opacityX, 0.5, this._elements.opacitySlider);
            }, 10);
        }

        on(event, callback) {
            if (!this._eventListeners[event]) {
                this._eventListeners[event] = [];
            }
            this._eventListeners[event].push(callback);
            return this;
        }

        off(event, callback) {
            if (this._eventListeners[event]) {
                const index = this._eventListeners[event].indexOf(callback);
                if (index > -1) {
                    this._eventListeners[event].splice(index, 1);
                }
            }
            return this;
        }

        _emit(event, ...args) {
            if (this._eventListeners[event]) {
                this._eventListeners[event].forEach(callback => {
                    try {
                        callback(...args);
                    } catch (e) {}
                });
            }
        }

        getColor() {
            return this._color;
        }

        setColor(color, silent = false) {
            let newColor;
            if (typeof color === 'string') {
                newColor = Color.fromString(color);
            } else if (color && typeof color.toHEXA === 'function') {
                newColor = color;
            } else {
                return false;
            }

            if (newColor) {
                this._color = newColor;
                this._safeUpdateFromColor();
                if (!silent) {
                    this._emit('change', this._color, 'api', this);
                }
                return true;
            }
            return false;
        }

        _safeUpdateFromColor() {
            if (this._elements.palette && this._elements.palette.offsetWidth > 0) {
                this._updateFromColor();
            } else {
                setTimeout(() => {
                    this._safeUpdateFromColor();
                }, 10);
            }
        }

        show() {
            if (!this._isOpen) {
                this._isOpen = true;
                this._app.style.display = 'block';
                this._ensureProperDisplay();
                this._emit('show', this._color);
            }
            return this;
        }

        _ensureProperDisplay() {
            setTimeout(() => {
                this._positionApp();
                const needsReinit = !this._elements.palette || 
                                  this._elements.palette.offsetWidth === 0 ||
                                  !this._elements.palettePicker.style.position;
                
                if (needsReinit) {
                    this._initializeSliders();
                    this._updateFromColor();
                }
                
                setTimeout(() => {
                    this._app.classList.add('visible');
                    this._updatePickerPositions();
                }, 10);
            }, 10);
        }

        hide() {
            if (this._isOpen) {
                this._isOpen = false;
                this._app.classList.remove('visible');
                setTimeout(() => {
                    if (!this._isOpen) {
                        this._app.style.display = 'none';
                    }
                }, 300);
                this._emit('hide');
            }
            return this;
        }

        isOpen() {
            return this._isOpen;
        }

        destroy() {
            if (this._app && this._app.parentNode) {
                this._app.parentNode.removeChild(this._app);
            }
            this._eventListeners = {};
        }
    }

    // Export to global scope
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LinkumoriPicker;
    } else if (typeof define === 'function' && define.amd) {
        define([], function() { return LinkumoriPicker; });
    } else {
        global.LinkumoriPicker = LinkumoriPicker;
    }

})(typeof window !== 'undefined' ? window : this);
