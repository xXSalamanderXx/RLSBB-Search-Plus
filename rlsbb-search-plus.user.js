// ==UserScript==
// @name         RLSBB Search+
// @namespace    https://rlsbb.ru/
// @version      1.0.6
// @description  Filtering, live custom search, safer clear handling, custom pagination, keyword highlighting, and category switching for RLSBB
// @author       xXSalamanderXx
// @homepage     https://github.com/xXSalamanderXx/RLSBB-Search-Plus/
// @supportURL   https://github.com/xXSalamanderXx/RLSBB-Search-Plus/issues/
// @updateURL    https://github.com/xXSalamanderXx/RLSBB-Search-Plus/raw/refs/heads/main/rlsbb-search-plus.user.js
// @downloadURL  https://github.com/xXSalamanderXx/RLSBB-Search-Plus/raw/refs/heads/main/rlsbb-search-plus.user.js
// @match        *://rlsbb.ru/*
// @match        *://www.rlsbb.ru/*
// @match        *://*.rlsbb.ru/*
// @match        *://rlsbb.to/*
// @match        *://www.rlsbb.to/*
// @match        *://*.rlsbb.to/*
// @match        *://rlsbb.com/*
// @match        *://www.rlsbb.com/*
// @match        *://*.rlsbb.com/*
// @match        *://rlsbb.cc/*
// @match        *://www.rlsbb.cc/*
// @match        *://*.rlsbb.cc/*
// @match        *://rlsbb.in/*
// @match        *://www.rlsbb.in/*
// @match        *://*.rlsbb.in/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_NAME = 'RLSBB Search+';
    const SCRIPT_ID = 'rlsbb-search-plus';

    const ACCENT = '#ff7a00';
    const ACCENT_BG = 'rgba(255,122,0,0.10)';
    const ACCENT_BORDER = 'rgba(255,122,0,0.40)';

    const SEARCH_ORANGE_TOP = '#ff8c1a';
    const SEARCH_ORANGE_BOTTOM = '#ff6a00';
    const SEARCH_ORANGE_HOVER_TOP = '#ff9b33';
    const SEARCH_ORANGE_HOVER_BOTTOM = '#ff7a00';
    const SEARCH_ORANGE_BORDER = 'rgba(255,140,26,0.65)';
    const SEARCH_ORANGE_GLOW = 'rgba(255,122,0,0.28)';
    const SEARCH_STATUS_ORANGE = '#ff9b33';

    const MAIN_BOX_GLOW = 'rgba(255,122,0,0.18)';
    const MAIN_BOX_GLOW_HOVER = 'rgba(255,122,0,0.34)';

    const KEYWORD_REGEX = /\b(rapidgator|nitroflare|torrent)\b/gi;

    let isLoadingPages = false;
    let abortController = null;
    let rootContainer = null;
    let resultsGrid = null;
    let observer = null;
    let observerPaused = false;
    let clearInProgress = false;
    let nativePaginationHTML = '';
    let refreshTimer = null;
    let baseListingUrl = '';
    let searchRunId = 0;
    let activeLoadToken = 0;
    let isStoppingNow = false;
    let uiRefreshQueued = false;
    let suppressObserverUntil = 0;
    let pendingClearAfterStop = false;
    let clearRetryTimer = null;

    const seenReleaseLinks = new Set();

    function injectStyles() {
        if (document.getElementById(`${SCRIPT_ID}-styles`)) return;

        const style = document.createElement('style');
        style.id = `${SCRIPT_ID}-styles`;
        style.textContent = `
            #${SCRIPT_ID}-bar {
                position: relative;
                z-index: 999;
                clear: both;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                overflow: visible;
                margin: 0 0 28px 0;
                padding: 16px 20px 20px 20px;
                border-radius: 14px;
                border: 1px solid rgba(255,255,255,0.08);
                background: #0d1015;
                color: #f3f4f6;
                font-size: 13px;
                box-shadow:
                    0 6px 24px rgba(0,0,0,0.35),
                    0 0 0 1px rgba(255,122,0,0.08) inset,
                    0 0 26px ${MAIN_BOX_GLOW},
                    0 0 44px rgba(255,122,0,0.08);
                transition: box-shadow 0.22s ease, transform 0.22s ease;
            }

            #${SCRIPT_ID}-bar:hover {
                box-shadow:
                    0 10px 28px rgba(0,0,0,0.40),
                    0 0 0 1px rgba(255,122,0,0.12) inset,
                    0 0 34px ${MAIN_BOX_GLOW_HOVER},
                    0 0 56px rgba(255,122,0,0.14);
            }

            #${SCRIPT_ID}-bar * {
                box-sizing: border-box;
            }

            /* Neon Flow Gradient Animation for Title */
            @keyframes neonFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            .fs-title-neon {
                font-size: 26px;
                font-weight: 900;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                background: linear-gradient(270deg, #ff0055, #ff7a00, #ffcc00, #ff7a00, #ff0055);
                background-size: 200% auto;
                color: transparent;
                -webkit-background-clip: text;
                background-clip: text;
                animation: neonFlow 4s linear infinite;
                letter-spacing: 0.5px;
                text-shadow: 0 0 12px rgba(255, 122, 0, 0.25);
                display: flex;
                align-items: center;
                gap: 6px;
                margin: 0;
            }

            #${SCRIPT_ID}-bar .fs-header-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 12px;
            }

            #${SCRIPT_ID}-bar .fs-filter-label {
                font-size: 11px;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 10px;
                font-weight: 700;
                display: block;
            }

            #${SCRIPT_ID}-bar .fs-toolbar-row {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                width: 100%;
                min-width: 0;
            }

            #${SCRIPT_ID}-bar .fs-toolbar-left {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                min-width: 0;
                flex: 1 1 auto;
            }

            #${SCRIPT_ID}-bar .fs-toolbar-right {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                justify-content: flex-end;
                min-width: 0;
                flex: 0 0 auto;
            }

            #${SCRIPT_ID}-bar .fs-search-select {
                flex: 0 1 180px;
                min-width: 170px;
            }

            #${SCRIPT_ID}-bar .fs-search-input {
                flex: 1 1 340px;
                min-width: 240px;
                max-width: 100%;
            }

            #${SCRIPT_ID}-bar .fs-size-pair {
                display: inline-flex;
                gap: 8px;
                align-items: center;
                flex: 0 0 auto;
                white-space: nowrap;
            }

            #${SCRIPT_ID}-bar .fs-section-line {
                border-top: 1px solid rgba(255,255,255,0.06);
                margin: 14px 0;
                width: 100%;
            }

            #f-progress-bar.fs-active {
                background: linear-gradient(90deg, #ff6a00 0%, #ff9b33 100%);
                box-shadow: 0 0 10px rgba(255, 122, 0, 0.8), 0 0 5px rgba(255, 122, 0, 0.5) inset;
            }

            .fs-search-match {
                outline: 1px solid rgba(255,140,26,0.65);
                box-shadow:
                    0 0 0 1px rgba(255,140,26,0.26) inset,
                    0 0 18px rgba(255,122,0,0.18),
                    0 0 34px rgba(255,122,0,0.10) !important;
            }

            .fs-visible-card {
                border-radius: 14px !important;
                overflow: hidden;
                box-shadow:
                    0 0 0 1px rgba(255,140,26,0.22),
                    0 0 20px rgba(255,122,0,0.18),
                    0 0 38px rgba(255,122,0,0.10) !important;
                transition: box-shadow 0.2s ease, transform 0.2s ease;
            }

            .fs-visible-card:hover {
                box-shadow:
                    0 0 0 1px rgba(255,140,26,0.32),
                    0 0 26px rgba(255,122,0,0.24),
                    0 0 46px rgba(255,122,0,0.14) !important;
                transform: translateY(-1px);
            }

            .fs-linkword-highlight {
                display: inline-block;
                padding: 0 5px;
                margin: 0 1px;
                border-radius: 999px;
                background: rgba(255,122,0,0.18);
                color: #ff9b33 !important;
                box-shadow:
                    0 0 0 1px rgba(255,122,0,0.22) inset,
                    0 0 10px rgba(255,122,0,0.12);
                font-weight: 700;
            }

            .fs-linkword-highlight a,
            a.fs-linkword-highlight {
                color: #ff9b33 !important;
                text-decoration: none !important;
            }

            .fs-hide-pagination {
                display: none !important;
            }

            #f-load-status,
            #f-search-status {
                min-height: 18px;
            }

            #f-custom-pagination {
                margin-top: 18px;
                padding-top: 16px;
                border-top: 1px solid rgba(255,255,255,0.08);
            }

            #f-custom-pagination .fs-pagination-wrap {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
            }

            #f-custom-pagination a,
            #f-custom-pagination span {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 34px;
                height: 32px;
                padding: 0 10px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1;
                text-decoration: none;
                box-sizing: border-box;
                white-space: nowrap;
            }

            #f-custom-pagination a {
                color: #f3f4f6;
                background: #171a21;
                border: 1px solid rgba(255,255,255,0.10);
                transition: all 0.18s ease;
            }

            #f-custom-pagination a:hover {
                border-color: rgba(255,140,26,0.50);
                box-shadow: 0 0 0 1px rgba(255,140,26,0.12) inset;
                transform: translateY(-1px);
            }

            #f-custom-pagination .current,
            #f-custom-pagination .active {
                color: #ffffff;
                background: linear-gradient(180deg, ${SEARCH_ORANGE_TOP} 0%, ${SEARCH_ORANGE_BOTTOM} 100%);
                border: 1px solid ${SEARCH_ORANGE_BORDER};
                font-weight: 700;
                text-shadow:
                    -1px 0 rgba(0,0,0,0.98),
                    0 1px rgba(0,0,0,0.98),
                    1px 0 rgba(0,0,0,0.98),
                    0 -1px rgba(0,0,0,0.98);
            }

            #fs-empty-state {
                display: none;
                margin: 18px 0 10px 0;
                padding: 18px 16px;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                background: #11161c;
                color: #d1d5db;
                font-size: 14px;
                line-height: 1.5;
                text-align: center;
            }

            #f-category-note {
                display: block;
                margin-top: 0px;
                margin-bottom: 6px;
                padding: 10px 14px;
                border-radius: 8px;
                background: rgba(255, 140, 26, 0.15);
                border: 1px solid rgba(255, 140, 26, 0.3);
                color: #e5e7eb;
                font-size: 12px;
                line-height: 1.5;
            }

            @media (max-width: 980px) {
                #${SCRIPT_ID}-bar .fs-header-row {
                    flex-direction: column;
                    align-items: flex-start;
                }

                #${SCRIPT_ID}-bar .fs-toolbar-left,
                #${SCRIPT_ID}-bar .fs-toolbar-right {
                    flex: 1 1 100%;
                    justify-content: flex-start;
                }

                #${SCRIPT_ID}-bar .fs-search-select,
                #${SCRIPT_ID}-bar .fs-search-input {
                    flex: 1 1 100%;
                    min-width: 100%;
                }

                #${SCRIPT_ID}-bar .fs-size-pair {
                    flex-wrap: nowrap;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getCurrentOrigin() {
        return window.location.origin;
    }

    function getHomeUrl() {
        const origin = getCurrentOrigin();
        if (origin.includes('search.')) {
            return origin.replace('search.', '');
        }
        return `${origin}/`;
    }

    function getMoviesUrl() {
        return `${getHomeUrl()}category/movies/`;
    }

    function getTvShowsUrl() {
        return `${getHomeUrl()}category/tv-shows/`;
    }

    function getCurrentPath() {
        return window.location.pathname.replace(/\/+$/, '/');
    }

    function isHomeCategoryPage() {
        return getCurrentPath() === '/';
    }

    function isMoviesCategoryPage() {
        return getCurrentPath().startsWith('/category/movies/');
    }

    function isTvShowsCategoryPage() {
        return getCurrentPath().startsWith('/category/tv-shows/');
    }

    function syncCategorySelectToLocation() {
        const select = document.getElementById('f-category');
        if (!select) return;

        if (isMoviesCategoryPage()) {
            select.value = getMoviesUrl();
        } else if (isTvShowsCategoryPage()) {
            select.value = getTvShowsUrl();
        } else if (isHomeCategoryPage() && !window.location.hostname.startsWith('search.')) {
            select.value = getHomeUrl();
        } else {
            select.value = '';
        }
    }

    function findPostItems(scope = document) {
        const selectors = [
            'article.post',
            'article.hentry',
            'article[id^="post-"]',
            '.post[id^="post-"]',
            '.post.hentry'
        ];

        const raw = [];
        for (const selector of selectors) {
            for (const node of scope.querySelectorAll(selector)) raw.push(node);
        }

        const unique = Array.from(new Set(raw)).filter(node => {
            if (!(node instanceof Element)) return false;
            if (node.closest('#' + SCRIPT_ID + '-bar')) return false;

            if (node.querySelector('article.post, article.hentry, article[id^="post-"]')) {
                const inner = node.querySelector('article.post, article.hentry, article[id^="post-"]');
                if (inner && inner !== node) return false;
            }

            return !!getDetailUrl(node) || !!node.textContent.trim();
        });

        return unique;
    }

    function pickResultsGrid(scope = document) {
        const candidates = [
            '.posts',
            '.post-list',
            '.entries',
            '.archive-posts',
            '.blog-posts',
            '.content-area',
            '#content',
            '#main',
            'main'
        ];

        for (const selector of candidates) {
            const nodes = Array.from(scope.querySelectorAll(selector));
            for (const node of nodes) {
                if (findPostItems(node).length >= 2) return node;
            }
        }

        const items = findPostItems(scope);
        if (items.length) return items[0].parentElement || scope.body || scope.documentElement || scope;
        return scope.body || scope.documentElement || scope;
    }

    function findContainer() {
        return pickResultsGrid(document);
    }

    function getActiveResultsGrid(container = rootContainer || document) {
        return resultsGrid || pickResultsGrid(container);
    }

    function getItemText(item) {
        return (item.innerText || item.textContent || '').trim();
    }

    function getTitleNode(item) {
        return item.querySelector('h1 a, h2 a, h3 a, .entry-title a, .post-title a, .title a');
    }

    function getDetailUrl(item) {
        return getTitleNode(item)?.href || item.querySelector('a[rel="bookmark"]')?.href || '';
    }

    function getItemKey(item) {
        return getDetailUrl(item) || getTitleNode(item)?.textContent?.trim() || getItemText(item).slice(0, 300);
    }

    function findNativePaginationElement(doc = document) {
        return doc.querySelector('.wp-pagenavi, .pagination, .nav-links, .navigation.pagination, .paging-navigation');
    }

    function captureNativePagination() {
        const el = findNativePaginationElement(document);
        if (el) nativePaginationHTML = el.outerHTML;
    }

    function hideNativePagination() {
        document.querySelectorAll('.wp-pagenavi, .pagination, .nav-links, .navigation.pagination, .page-numbers, .paging-navigation')
            .forEach(el => el.classList.add('fs-hide-pagination'));
    }

    function renderCustomPagination() {
        const host = document.getElementById('f-custom-pagination');
        if (!host) return;

        host.innerHTML = '';
        if (!nativePaginationHTML) return;

        const temp = document.createElement('div');
        temp.innerHTML = nativePaginationHTML;
        const original = temp.firstElementChild;
        if (!original) return;

        const wrap = document.createElement('div');
        wrap.className = 'fs-pagination-wrap';

        const items = Array.from(original.querySelectorAll('a, span'));
        for (const item of items) {
            const clone = item.cloneNode(true);
            const rawText = (clone.textContent || '').trim();
            if (!rawText) continue;

            if (/^previous(\s+page)?$/i.test(rawText) || /^prev(ious)?$/i.test(rawText)) {
                clone.textContent = '←';
                clone.title = 'Previous Page';
            } else if (/^next(\s+page)?$/i.test(rawText) || /^next$/i.test(rawText)) {
                clone.textContent = '→';
                clone.title = 'Next Page';
            }

            const finalText = (clone.textContent || '').trim();

            if (clone.tagName.toLowerCase() === 'span') {
                const cls = clone.className || '';
                const isCurrent = /current|active/i.test(cls);
                if (isCurrent || /^\d+$/.test(finalText) || finalText === '←' || finalText === '→') {
                    if (isCurrent) clone.classList.add('current');
                    wrap.appendChild(clone);
                }
            } else {
                wrap.appendChild(clone);
            }
        }

        if (wrap.children.length) host.appendChild(wrap);
    }

    function ensureEmptyState(container) {
        const itemGrid = getActiveResultsGrid(container);
        let emptyState = document.getElementById('fs-empty-state');

        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = 'fs-empty-state';
            emptyState.textContent = 'No Results: Press Clear To Reset Search Filters or Modify Your Current Filters';
            itemGrid.parentNode.insertBefore(emptyState, itemGrid);
        }

        return emptyState;
    }

    function updateEmptyState(container, hasVisibleItems) {
        const emptyState = ensureEmptyState(container);
        emptyState.style.display = hasVisibleItems ? 'none' : 'block';
    }

    function getBaseListingUrl() {
        const url = new URL(window.location.href);
        url.pathname = url.pathname.replace(/\/page\/\d+\/?$/, '/');
        return `${url.origin}${url.pathname}${url.search}`;
    }

    function buildPageUrl(pageNum) {
        const base = new URL(baseListingUrl || getBaseListingUrl());
        if (pageNum <= 1) return base.toString();
        const cleanPath = base.pathname.replace(/\/+$/, '');
        return `${base.origin}${cleanPath}/page/${pageNum}/${base.search}`;
    }

    function normalizeSearchText(str) {
        return (str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function squeezeSearchText(str) {
        return normalizeSearchText(str).replace(/[^a-z0-9]+/g, '');
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function matchesCustomSearchText(text, query) {
        if (!query) return true;

        const normalizedText = normalizeSearchText(text);
        const squeezedText = squeezeSearchText(text);
        const tokens = normalizeSearchText(query).split(/[^a-z0-9]+/).filter(Boolean);

        if (!tokens.length) return true;

        const squeezedQuery = tokens.join('');
        if (squeezedQuery && squeezedText.includes(squeezedQuery)) return true;

        const loosePattern = tokens.map(escapeRegExp).join('[^a-z0-9]*');
        try {
            return new RegExp(loosePattern, 'i').test(normalizedText);
        } catch (_) {
            return normalizedText.includes(normalizeSearchText(query));
        }
    }

    function hasDV(item) {
        return /\b(dolby\s*vision|dv)\b/i.test(getItemText(item));
    }

    function hasHDR(item) {
        return /\b(hdr|hdr10\+?|uhd)\b/i.test(getItemText(item));
    }

    function getRating(item) {
        const text = getItemText(item);
        const match = text.match(/(\d+(\.\d+)?)\s*\/\s*10/i) || text.match(/imdb[^0-9]{0,12}(\d+(\.\d+)?)/i);
        return match ? parseFloat(match[1]) : 0;
    }

    function getSize(item) {
        const text = getItemText(item);
        const match = text.match(/(\d+(\.\d+)?)\s*(GB|MB)\b/i);
        if (!match) return null;

        const value = parseFloat(match[1]);
        const unit = match[3].toUpperCase();
        return unit === 'MB' ? value / 1024 : value;
    }

    function getResolution(item) {
        const text = getItemText(item);
        if (/\b2160p\b|\b4k\b|\buhd\b/i.test(text)) return '2160p';
        if (/\b1440p\b/i.test(text)) return '1440p';
        if (/\b1080p\b/i.test(text)) return '1080p';
        if (/\b720p\b/i.test(text)) return '720p';
        if (/\b576p\b/i.test(text)) return '576p';
        if (/\b480p\b/i.test(text)) return '480p';
        if (/\b360p\b/i.test(text)) return '360p';
        return '';
    }

    function getGroup(item) {
        const title = getTitleNode(item)?.textContent?.trim() || getItemText(item).split('\n')[0] || '';
        const clean = title.replace(/\(\s*\d+(\.\d+)?\s*(GB|MB)\s*\)/i, '').trim();
        const parts = clean.split('-').map(s => s.trim()).filter(Boolean);
        if (parts.length < 2) return '';
        return parts[parts.length - 1];
    }

    function indexExistingItems(container) {
        for (const item of findPostItems(container)) {
            const key = getItemKey(item);
            if (key) seenReleaseLinks.add(key);
        }
    }

    function buildGroupDropdown(container) {
        const select = document.getElementById('f-group');
        if (!select) return;

        const current = select.value;
        const groups = new Set();

        for (const item of findPostItems(container)) {
            if (item.style.display === 'none') continue;
            const g = getGroup(item);
            if (g) groups.add(g);
        }

        const sorted = Array.from(groups).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        select.innerHTML = '<option value="">All Release Groups</option>';

        for (const g of sorted) {
            const opt = document.createElement('option');
            opt.value = g.toLowerCase();
            opt.textContent = g;
            select.appendChild(opt);
        }

        if (current && Array.from(select.options).some(o => o.value === current)) {
            select.value = current;
        }
    }

    function getFilterValues() {
        return {
            onlyDV: document.getElementById('f-dv')?.checked || false,
            onlyHDR: document.getElementById('f-hdr')?.checked || false,
            res: document.getElementById('f-res')?.value || '',
            minRating: parseFloat(document.getElementById('f-rating')?.value) || 0,
            minSize: parseFloat(document.getElementById('f-minsize')?.value) || 0,
            maxSize: parseFloat(document.getElementById('f-maxsize')?.value) || Infinity,
            group: (document.getElementById('f-group')?.value || '').toLowerCase().trim(),
            search: (document.getElementById('f-search')?.value || '').trim(),
        };
    }

    function itemMatchesBaseFilters(item, f) {
        if (f.onlyDV && !hasDV(item)) return false;
        if (f.onlyHDR && !hasHDR(item)) return false;
        if (f.res && getResolution(item) !== f.res) return false;
        if (getRating(item) < f.minRating) return false;

        const size = getSize(item);
        if (size !== null && (size < f.minSize || size > f.maxSize)) return false;

        if (f.group && getGroup(item).toLowerCase() !== f.group) return false;
        return true;
    }

    function saveFilters() {
        const data = {};
        for (const el of document.querySelectorAll(`#${SCRIPT_ID}-bar input, #${SCRIPT_ID}-bar select`)) {
            if (el.id === 'f-category') continue;
            data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        }

        try {
            localStorage.setItem(`${SCRIPT_ID}-filters`, JSON.stringify(data));
        } catch (_) {}
    }

    function loadFilters() {
        try {
            const data = JSON.parse(localStorage.getItem(`${SCRIPT_ID}-filters`) || '{}');
            for (const [id, val] of Object.entries(data)) {
                if (id === 'f-category') continue;
                const el = document.getElementById(id);
                if (!el) continue;
                if (el.type === 'checkbox') el.checked = val;
                else el.value = val;
            }
        } catch (_) {}
    }

    function setStatus(text = '') {
        const el = document.getElementById('f-load-status');
        if (el) el.textContent = text;
    }

    function showProgress() {
        const wrap = document.getElementById('f-progress-wrap');
        const bar = document.getElementById('f-progress-bar');
        if (wrap) wrap.style.display = 'block';
        if (bar) {
            bar.style.width = '2%';
            bar.classList.add('fs-active');
        }
    }

    function updateProgress(current, max) {
        const bar = document.getElementById('f-progress-bar');
        if (!bar) return;
        let pct = 0;
        if (max > 0) {
            pct = (current / max) * 100;
        }
        pct = Math.min(100, Math.max(2, pct)); 
        bar.style.width = pct + '%';
    }

    function hideProgress(immediate = false) {
        const wrap = document.getElementById('f-progress-wrap');
        const bar = document.getElementById('f-progress-bar');

        const done = () => {
            if (wrap) wrap.style.display = 'none';
            if (bar) {
                bar.classList.remove('fs-active');
                bar.style.width = '0%';
            }
        };

        if (immediate) done();
        else setTimeout(done, 350);
    }

    function pauseObserver() {
        if (observer && !observerPaused) {
            observer.disconnect();
            observerPaused = true;
        }
    }

    function resumeObserver() {
        if (observer && observerPaused && resultsGrid) {
            observer.observe(resultsGrid, { childList: true, subtree: true });
            observerPaused = false;
        }
    }

    function highlightKeywordLinks(container) {
        for (const item of findPostItems(container)) {
            const nodes = item.querySelectorAll('a, strong, b, span');
            nodes.forEach(node => {
                if (node.closest('#' + SCRIPT_ID + '-bar')) return;
                const text = (node.textContent || '').trim();
                if (KEYWORD_REGEX.test(text)) node.classList.add('fs-linkword-highlight');
                else node.classList.remove('fs-linkword-highlight');
                KEYWORD_REGEX.lastIndex = 0;
            });
        }
    }

    function styleVisibleResults(container) {
        for (const item of findPostItems(container)) {
            if (item.style.display === 'none') item.classList.remove('fs-visible-card');
            else item.classList.add('fs-visible-card');
        }
        highlightKeywordLinks(container);
    }

    function applyFilters(container) {
        const f = getFilterValues();
        const items = findPostItems(container);
        let searchMatches = 0;
        let visibleCount = 0;

        for (const item of items) {
            const matchesBase = itemMatchesBaseFilters(item, f);
            const matchesSearch = f.search ? matchesCustomSearchText(getItemText(item), f.search) : false;

            if (f.search) {
                const finalMatch = matchesBase && matchesSearch;
                item.style.display = finalMatch ? '' : 'none';
                item.classList.toggle('fs-search-match', finalMatch);
                if (finalMatch) {
                    searchMatches++;
                    visibleCount++;
                }
            } else {
                item.style.display = matchesBase ? '' : 'none';
                item.classList.remove('fs-search-match');
                if (matchesBase) visibleCount++;
            }
        }

        if (!f.group) buildGroupDropdown(container);

        const searchStatus = document.getElementById('f-search-status');
        if (searchStatus) {
            if (f.search) {
                searchStatus.textContent = isLoadingPages
                    ? `${searchMatches} Results Found For Custom Search — Searching More Pages....`
                    : `${searchMatches} Results Found For Custom Search`;
                searchStatus.style.display = 'block';
                searchStatus.style.color = SEARCH_STATUS_ORANGE;
            } else {
                searchStatus.textContent = '';
                searchStatus.style.display = 'none';
            }
        }

        styleVisibleResults(container);
        updateEmptyState(container, visibleCount > 0);
        saveFilters();
        return { searchMatches, visibleCount };
    }

    function queueUIRefresh(container, opts = {}) {
        if (uiRefreshQueued) return;
        uiRefreshQueued = true;

        requestAnimationFrame(() => {
            uiRefreshQueued = false;
            hideNativePagination();
            renderCustomPagination();
            buildGroupDropdown(container);
            applyFilters(container);
            syncCategorySelectToLocation();

            if (opts.clearStatus) {
                setStatus('');
                const searchStatus = document.getElementById('f-search-status');
                if (searchStatus && !getFilterValues().search) {
                    searchStatus.textContent = '';
                    searchStatus.style.display = 'none';
                }
            }
        });
    }

    function scheduleRefresh(container) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            queueUIRefresh(container);
        }, 80);
    }

    function abortActiveLoading(reason = 'stopped') {
        if (!abortController || isStoppingNow) return false;

        isStoppingNow = true;
        suppressObserverUntil = Date.now() + 800;
        activeLoadToken++;
        searchRunId++;

        try {
            abortController.abort(reason);
        } catch (_) {}

        return true;
    }

    function finishStopUI() {
        abortController = null;
        isLoadingPages = false;
        isStoppingNow = false;

        const stopBtn = document.getElementById('f-stop-loading');
        const loadBtn = document.getElementById('f-loadall');

        if (stopBtn) {
            stopBtn.style.display = 'none';
            stopBtn.disabled = false;
        }
        if (loadBtn) loadBtn.disabled = false;

        hideProgress(true);
    }

    function stopLoading() {
        if (!isLoadingPages && !abortController) {
            if (pendingClearAfterStop && rootContainer) {
                pendingClearAfterStop = false;
                clearFilters(rootContainer);
            }
            return;
        }

        if (isStoppingNow) return;

        const didAbort = abortActiveLoading('user-stop');

        const stopBtn = document.getElementById('f-stop-loading');
        const loadBtn = document.getElementById('f-loadall');

        if (stopBtn) stopBtn.disabled = true;
        if (loadBtn) loadBtn.disabled = true;

        setStatus('Stopping Search....');
        hideProgress(true);

        if (!didAbort) {
            finishStopUI();
            queueUIRefresh(rootContainer);

            if (pendingClearAfterStop && rootContainer) {
                pendingClearAfterStop = false;
                clearFilters(rootContainer);
            }
        }
    }

    function clearFilters(container) {
        if (clearInProgress) return;

        if (isLoadingPages || abortController || isStoppingNow) {
            pendingClearAfterStop = true;
            stopLoading();

            clearTimeout(clearRetryTimer);
            clearRetryTimer = setTimeout(function waitForStop() {
                if (isLoadingPages || abortController || isStoppingNow) {
                    clearRetryTimer = setTimeout(waitForStop, 60);
                    return;
                }

                pendingClearAfterStop = false;
                clearFilters(container);
            }, 60);

            return;
        }

        clearInProgress = true;
        suppressObserverUntil = Date.now() + 1000;

        try {
            clearTimeout(refreshTimer);
            clearTimeout(clearRetryTimer);
            pauseObserver();

            for (const el of document.querySelectorAll(`#${SCRIPT_ID}-bar input, #${SCRIPT_ID}-bar select`)) {
                if (el.id === 'f-category') {
                    continue;
                } else if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            }

            try {
                localStorage.removeItem(`${SCRIPT_ID}-filters`);
            } catch (_) {}

            syncCategorySelectToLocation();

            const stopBtn = document.getElementById('f-stop-loading');
            const loadBtn = document.getElementById('f-loadall');

            if (stopBtn) {
                stopBtn.style.display = 'none';
                stopBtn.disabled = false;
            }
            if (loadBtn) loadBtn.disabled = false;

            abortController = null;
            isLoadingPages = false;
            isStoppingNow = false;

            setStatus('');

            const searchStatus = document.getElementById('f-search-status');
            if (searchStatus) {
                searchStatus.textContent = '';
                searchStatus.style.display = 'none';
            }

            applyFilters(container);
            styleVisibleResults(container);
            hideNativePagination();
            renderCustomPagination();
            updateEmptyState(container, findPostItems(container).some(item => item.style.display !== 'none'));
        } finally {
            setTimeout(() => {
                resumeObserver();
            }, 50);
            clearInProgress = false;
        }
    }

    function extractMaxPages(doc = document) {
        let max = 1;

        const pageLinks = doc.querySelectorAll('.wp-pagenavi a, .pagination a, .nav-links a, a.page-numbers, .paging-navigation a, a.last');
        for (const link of pageLinks) {
            const href = link.getAttribute('href') || '';
            const hrefMatch = href.match(/\/page\/(\d+)\/?/i) || href.match(/[?&]paged=(\d+)/i);
            if (hrefMatch) {
                const parsed = parseInt(hrefMatch[1], 10);
                if (!isNaN(parsed) && parsed > max) {
                    max = parsed;
                }
            }
        }

        const pageElements = doc.querySelectorAll('.wp-pagenavi, .wp-pagenavi span, .pagination, .pages, .page-numbers, span.page-numbers');
        for (const el of pageElements) {
            const text = (el.textContent || '').trim();
            const ofMatch = text.match(/of\s+([0-9,]+)/i);
            if (ofMatch) {
                const parsed = parseInt(ofMatch[1].replace(/,/g, ''), 10);
                if (!isNaN(parsed) && parsed > max) {
                    max = parsed;
                }
            }
            
            const numMatch = text.match(/^[0-9,]+$/);
            if (numMatch) {
                const parsed = parseInt(numMatch[0].replace(/,/g, ''), 10);
                if (!isNaN(parsed) && parsed > max) {
                    max = parsed;
                }
            }
        }

        return max;
    }


    async function resetResultsToFirstPage(container, signal, runId) {
        const itemGrid = getActiveResultsGrid(container);
        const firstPageUrl = buildPageUrl(1);

        setStatus('Loading First Page....');

        const res = await fetch(firstPageUrl, {
            credentials: 'same-origin',
            signal,
            cache: 'no-store'
        });

        if (!res.ok || signal.aborted || runId !== searchRunId) return { success: false, maxPages: 1 };

        const html = await res.text();
        if (signal.aborted || runId !== searchRunId) return { success: false, maxPages: 1 };

        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const maxPages = extractMaxPages(doc);

        const nativePager = findNativePaginationElement(doc);
        if (nativePager) nativePaginationHTML = nativePager.outerHTML;

        doc.querySelectorAll('.wp-pagenavi, .pagination, .nav-links, .navigation.pagination, .page-numbers, .paging-navigation')
            .forEach(el => el.remove());

        const sourceGrid = pickResultsGrid(doc);
        const fetchedItems = findPostItems(sourceGrid);
        if (!fetchedItems.length) return { success: false, maxPages: 1 };

        const fragment = document.createDocumentFragment();
        seenReleaseLinks.clear();

        for (const node of fetchedItems) {
            const clone = document.importNode(node, true);
            clone.removeAttribute('style');
            fragment.appendChild(clone);

            const key = getItemKey(clone);
            if (key) seenReleaseLinks.add(key);
        }

        pauseObserver();
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                itemGrid.innerHTML = '';
                itemGrid.appendChild(fragment);
                resolve();
            });
        });
        resumeObserver();

        resultsGrid = itemGrid;
        hideNativePagination();
        renderCustomPagination();
        applyFilters(container);
        syncCategorySelectToLocation();

        return { success: true, maxPages };
    }

    async function loadAllPages(container) {
        const runId = ++searchRunId;
        const localToken = ++activeLoadToken;

        showProgress();
        abortController = new AbortController();
        const { signal } = abortController;

        let loaded = 0;
        let stopReason = 'complete';
        let totalSearchPages = 1;

        try {
            baseListingUrl = getBaseListingUrl();
            resultsGrid = getActiveResultsGrid(container);

            const firstPageResult = await resetResultsToFirstPage(container, signal, runId);
            if (!firstPageResult || !firstPageResult.success) {
                stopReason = signal.aborted ? 'stopped' : 'complete';
                return;
            }

            totalSearchPages = firstPageResult.maxPages || 1;
            loaded = 1;
            updateProgress(loaded, totalSearchPages);

            const firstState = applyFilters(container);
            if (getFilterValues().search) {
                setStatus(`${firstState.searchMatches} Result(s) Found So Far — Scanned ${loaded} Page(s)`);
            } else {
                setStatus(`${loaded} Page(s) Loaded`);
            }

            for (let p = 2; ; p++) {
                if (signal.aborted || runId !== searchRunId || localToken !== activeLoadToken) {
                    stopReason = 'stopped';
                    break;
                }

                setStatus(`Searching Page ${p} For Results....`);

                const url = buildPageUrl(p);
                const res = await fetch(url, {
                    credentials: 'same-origin',
                    signal,
                    cache: 'no-store'
                });

                if (!res.ok) {
                    stopReason = 'complete';
                    break;
                }

                const html = await res.text();
                if (signal.aborted || runId !== searchRunId || localToken !== activeLoadToken) {
                    stopReason = 'stopped';
                    break;
                }

                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('.wp-pagenavi, .pagination, .nav-links, .navigation.pagination, .page-numbers, .paging-navigation')
                    .forEach(el => el.remove());

                const sourceGrid = pickResultsGrid(doc);
                const fetchedItems = findPostItems(sourceGrid);
                if (!fetchedItems.length) {
                    stopReason = 'complete';
                    break;
                }

                const itemGrid = getActiveResultsGrid(container);
                const fragment = document.createDocumentFragment();
                let newItemsCount = 0;

                for (const node of fetchedItems) {
                    const key = getItemKey(node);
                    if (!key || seenReleaseLinks.has(key)) continue;

                    const clone = document.importNode(node, true);
                    clone.removeAttribute('style');
                    fragment.appendChild(clone);
                    seenReleaseLinks.add(key);
                    newItemsCount++;
                }

                if (newItemsCount === 0) continue;

                pauseObserver();
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        itemGrid.appendChild(fragment);
                        resolve();
                    });
                });
                resumeObserver();

                resultsGrid = itemGrid;
                loaded++;
                updateProgress(loaded, Math.max(totalSearchPages, loaded));

                const state = applyFilters(container);
                if (getFilterValues().search) {
                    setStatus(`${state.searchMatches} Result(s) Found So Far — Scanned ${loaded} Page(s)`);
                } else {
                    setStatus(`${loaded} Page(s) Loaded`);
                }

                await new Promise(r => setTimeout(r, 60));
            }
        } catch (e) {
            if (e.name === 'AbortError' || signal.aborted) {
                stopReason = 'stopped';
            } else {
                console.error(`${SCRIPT_NAME}: load pages error`, e);
                stopReason = 'error';
            }
        } finally {
            const wasStopping = isStoppingNow;

            finishStopUI();

            const finalState = applyFilters(container);
            queueUIRefresh(container);

            if (!clearInProgress) {
                if (stopReason === 'stopped' || wasStopping) {
                    setStatus(
                        getFilterValues().search
                            ? `${finalState.searchMatches} Result(s) Found`
                            : (loaded > 0 ? `Stopped — ${loaded} Page(s) Loaded` : 'Search Stopped')
                    );
                } else if (stopReason === 'error') {
                    setStatus('Error Loading Pages');
                } else {
                    setStatus(
                        getFilterValues().search
                            ? `${finalState.searchMatches} Result(s) Found`
                            : (loaded > 0 ? `${loaded} Page(s) Loaded` : 'No More Pages To Load')
                    );
                }
            }

            if (pendingClearAfterStop && !clearInProgress) {
                setTimeout(() => {
                    if (rootContainer && !isLoadingPages && !abortController && !isStoppingNow) {
                        pendingClearAfterStop = false;
                        clearFilters(rootContainer);
                    }
                }, 40);
            }

            setTimeout(() => {
                const t = document.getElementById('f-load-status')?.textContent || '';
                if (
                    t === 'Error Loading Pages' ||
                    t === 'Search Stopped' ||
                    t === 'Stopping Search....' ||
                    t.startsWith('Stopped —') ||
                    t.endsWith('Page(s) Loaded') ||
                    t.endsWith('Result(s) Found') ||
                    t === 'No More Pages To Load'
                ) {
                    setStatus('');
                }
            }, 2500);
        }
    }

    const INPUT_STYLE = `
        background: #1a1f26;
        color: #f3f4f6;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
        height: 32px;
        box-sizing: border-box;
    `;

    function createBar() {
        const bar = document.createElement('div');
        bar.id = `${SCRIPT_ID}-bar`;

        bar.innerHTML = `
            <div class="fs-header-row">
                <div class="fs-title-neon">⚡ ${SCRIPT_NAME}</div>
                
                <select id="f-category" style="${INPUT_STYLE} width:250px; border-color: rgba(255,140,26,0.3); font-weight: 600;">
                    <option value="">Select Category (redirects)</option>
                    <option value="${getHomeUrl()}">Home</option>
                    <option value="${getMoviesUrl()}">Movies</option>
                    <option value="${getTvShowsUrl()}">TV Shows</option>
                </select>
            </div>
            
            <div id="f-category-note">
                <strong>Recommended Use:</strong> First search on main site search and use this to narrow down your results.
            </div>

            <div class="fs-section-line"></div>
            <span class="fs-filter-label">Filters - Modify these to get specific tailored results!</span>
            
            <div class="fs-toolbar-row" style="margin-bottom: 12px;">
                <div class="fs-toolbar-left">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" id="f-dv" style="accent-color:${ACCENT}; width:16px; height:16px;">
                        <span>Dolby Vision</span>
                    </label>

                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; margin-right: 6px;">
                        <input type="checkbox" id="f-hdr" style="accent-color:${ACCENT}; width:16px; height:16px;">
                        <span>HDR</span>
                    </label>

                    <select id="f-res" style="${INPUT_STYLE} width:145px;">
                        <option value="">All Resolutions</option>
                        <option value="2160p">2160p</option>
                        <option value="1440p">1440p</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="576p">576p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                    </select>

                    <input type="number" id="f-rating" placeholder="Minimum Rating" step="0.1" min="0" max="10"
                        style="${INPUT_STYLE} width:145px;">

                    <span class="fs-size-pair">
                        <input type="number" id="f-minsize" placeholder="Min GB" min="0"
                            style="${INPUT_STYLE} width:88px;">

                        <input type="number" id="f-maxsize" placeholder="Max GB" min="0"
                            style="${INPUT_STYLE} width:88px;">
                    </span>

                    <select id="f-group" class="fs-search-select" style="${INPUT_STYLE} width:175px;">
                        <option value="">All Release Groups</option>
                    </select>
                </div>
            </div>

            <div class="fs-toolbar-row">
                <div class="fs-toolbar-left" style="flex: 1 1 auto;">
                    <input type="text" id="f-search" class="fs-search-input" placeholder="Search anything..."
                        style="${INPUT_STYLE} width:100%;">
                </div>

                <div class="fs-toolbar-right" style="flex: 0 0 auto;">
                    <button id="f-stop-loading"
                        style="display:none; background:transparent; color:#f59e0b;
                               border:1px solid rgba(245,158,11,0.35);
                               border-radius:8px; padding:5px 12px; cursor:pointer; font-size:13px; font-weight:600;
                               height:32px; box-sizing:border-box; transition:all 0.2s; white-space:nowrap;">
                        Stop Page Loading
                    </button>

                    <button id="f-loadall"
                        style="background:linear-gradient(180deg, ${SEARCH_ORANGE_TOP} 0%, ${SEARCH_ORANGE_BOTTOM} 100%);
                               color:#ffffff;
                               border:1px solid ${SEARCH_ORANGE_BORDER};
                               border-radius:8px; padding:5px 18px; cursor:pointer; font-size:13px;
                               font-weight:800; height:32px; box-sizing:border-box; transition:all 0.2s ease;
                               white-space:nowrap;
                               -webkit-text-stroke:0.9px rgba(0,0,0,0.98);
                               text-shadow:
                                   -1px 0 rgba(0,0,0,0.98),
                                   0 1px rgba(0,0,0,0.98),
                                   1px 0 rgba(0,0,0,0.98),
                                   0 -1px rgba(0,0,0,0.98),
                                   -1px -1px rgba(0,0,0,0.75),
                                   1px 1px rgba(0,0,0,0.75);
                               box-shadow:
                                   inset 0 1px 0 rgba(255,255,255,0.14),
                                   0 0 0 1px rgba(255,122,0,0.32),
                                   0 8px 18px rgba(0,0,0,0.24),
                                   0 0 12px ${SEARCH_ORANGE_GLOW};">
                        Search
                    </button>

                    <div style="width:1px; height:22px; background:#30363d; margin: 0 4px;"></div>

                    <button id="f-clear"
                        style="background:transparent; color:#f87171;
                               border:1px solid rgba(248,113,113,0.35);
                               border-radius:8px; padding:5px 14px; cursor:pointer; font-size:13px; font-weight:600;
                               height:32px; box-sizing:border-box; transition:all 0.2s; white-space:nowrap;">
                        Clear
                    </button>
                </div>
            </div>
            
            <div class="fs-section-line"></div>

            <div style="margin-top:6px;">
                <div id="f-load-status"
                    style="color:#9ca3af; font-size:12px; line-height:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
            </div>

            <div style="margin-top:4px; margin-bottom:12px;">
                <div id="f-search-status"
                    style="display:none; color:${SEARCH_STATUS_ORANGE}; font-size:12px; font-weight:700; letter-spacing:0.2px; line-height:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
            </div>

            <div id="f-progress-wrap" style="display:none; margin-top:6px;">
                <div style="background:#21262d; border-radius:999px; height:6px; overflow:hidden;">
                    <div id="f-progress-bar" style="height:100%; width:0%; border-radius:999px; transition:width 0.3s ease;"></div>
                </div>
            </div>

            <div id="f-custom-pagination"></div>
        `;

        bar.addEventListener('mouseover', e => {
            if (e.target.id === 'f-loadall') {
                e.target.style.background = `linear-gradient(180deg, ${SEARCH_ORANGE_HOVER_TOP} 0%, ${SEARCH_ORANGE_HOVER_BOTTOM} 100%)`;
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow =
                    'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(255,140,26,0.55), 0 10px 20px rgba(0,0,0,0.28), 0 0 16px rgba(255,122,0,0.24)';
            }
            if (e.target.id === 'f-stop-loading') {
                e.target.style.background = 'rgba(245,158,11,0.12)';
                e.target.style.borderColor = 'rgba(245,158,11,0.6)';
            }
            if (e.target.id === 'f-clear') {
                e.target.style.background = 'rgba(248,113,113,0.12)';
                e.target.style.borderColor = 'rgba(248,113,113,0.6)';
            }
        });

        bar.addEventListener('mouseout', e => {
            if (e.target.id === 'f-loadall') {
                e.target.style.background = `linear-gradient(180deg, ${SEARCH_ORANGE_TOP} 0%, ${SEARCH_ORANGE_BOTTOM} 100%)`;
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow =
                    `inset 0 1px 0 rgba(255,255,255,0.14),
                     0 0 0 1px rgba(255,122,0,0.32),
                     0 8px 18px rgba(0,0,0,0.24),
                     0 0 12px ${SEARCH_ORANGE_GLOW}`;
            }
            if (e.target.id === 'f-stop-loading') {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(245,158,11,0.35)';
            }
            if (e.target.id === 'f-clear') {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(248,113,113,0.35)';
            }
        });

        return bar;
    }

    function createObserver() {
        if (!resultsGrid) return;

        if (observer) {
            try { observer.disconnect(); } catch (_) {}
        }

        let debounceTimer;
        observer = new MutationObserver(() => {
            if (observerPaused || clearInProgress || isStoppingNow) return;
            if (Date.now() < suppressObserverUntil) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                indexExistingItems(rootContainer);
                queueUIRefresh(rootContainer);
            }, 100);
        });

        observer.observe(resultsGrid, { childList: true, subtree: true });
        observerPaused = false;
    }

    function init(container) {
        if (document.getElementById(`${SCRIPT_ID}-bar`)) return;

        rootContainer = container;
        resultsGrid = getActiveResultsGrid(container);
        baseListingUrl = getBaseListingUrl();

        injectStyles();
        captureNativePagination();
        hideNativePagination();
        indexExistingItems(container);

        const bar = createBar();
        resultsGrid.insertAdjacentElement('beforebegin', bar);
        resultsGrid.style.marginTop = '6px';

        ensureEmptyState(container);
        renderCustomPagination();

        const searchInput = bar.querySelector('#f-search');

        bar.querySelector('#f-clear').addEventListener('click', () => clearFilters(container));
        bar.querySelector('#f-stop-loading').addEventListener('click', () => stopLoading());

        bar.querySelector('#f-loadall').addEventListener('click', async function () {
            if (clearInProgress || isStoppingNow) return;
            if (isLoadingPages && abortController) return;

            this.disabled = true;

            const stopBtn = document.getElementById('f-stop-loading');
            if (stopBtn) {
                stopBtn.style.display = 'inline-block';
                stopBtn.disabled = false;
            }

            isLoadingPages = true;
            isStoppingNow = false;
            baseListingUrl = getBaseListingUrl();
            resultsGrid = getActiveResultsGrid(container);

            applyFilters(container);
            await loadAllPages(container);
        });

        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!isLoadingPages && !clearInProgress && !isStoppingNow) {
                    bar.querySelector('#f-loadall').click();
                }
            }
        });

        for (const el of bar.querySelectorAll('input, select')) {
            if (el.id === 'f-search' || el.id === 'f-category') continue;
            el.addEventListener('input', () => applyFilters(container));
        }

        bar.querySelector('#f-category').addEventListener('change', function () {
            const targetUrl = this.value;
            if (!targetUrl) return;

            const here = window.location.href.replace(/\/+$/, '/');
            const there = targetUrl.replace(/\/+$/, '/');

            if (here !== there) {
                window.location.href = targetUrl;
            }
        });

        searchInput.addEventListener('input', () => applyFilters(container));

        buildGroupDropdown(container);
        loadFilters();
        syncCategorySelectToLocation();
        applyFilters(container);
        createObserver();
    }

    function waitForContainer() {
        const container = findContainer();
        if (container) {
            init(container);
        } else {
            setTimeout(waitForContainer, 400);
        }
    }

    waitForContainer();
})();
