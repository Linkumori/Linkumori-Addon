
/*
 * ============================================================
 * Linkumori — regression page
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * Added regression page.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-05-29   Subham Mahesh   File created
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
 --*/
(function(){
    const THEMES=['midnight','light','icecold','dark','sunset'];
    const LABELS={midnight:'Midnight',light:'Light',icecold:'Ice Cold',dark:'Zen Grey',sunset:'Sunset'};
    function setTheme(n){
        document.documentElement.setAttribute('data-theme',n);
        localStorage.setItem('linkumori-theme',n);
        document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===n));
    }
    document.addEventListener('DOMContentLoaded',function(){
        const bar=document.getElementById('theme-bar');
        THEMES.forEach(t=>{
            const btn=document.createElement('button');
            btn.className='theme-btn'; btn.dataset.theme=t;
            btn.innerHTML='<span class="swatch swatch-'+t+'"></span>'+LABELS[t];
            btn.addEventListener('click',()=>setTheme(t));
            bar.appendChild(btn);
        });
        setTheme(localStorage.getItem('linkumori-theme')||'midnight');
    });
})();