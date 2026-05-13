# Linkumori Maintainer Wiki

This wiki explains how Linkumori works internally. It is written for:

- maintainers extending the extension
- contributors adding rules, UI, or platform support
- reviewers who need to understand request flow and performance decisions
- future debugging sessions where the architecture matters more than one file

## Start Here

1. [Architecture Overview](./architecture.md)
2. [Runtime Pipeline](./runtime-pipeline.md)
3. [Rules, Storage, and Data](./rules-storage-data.md)
4. [Current Rule Syntax](./current-rule-syntax.md)
5. [Module Reference](./module-reference.md)

## One-Screen Mental Model

Linkumori is a Firefox Manifest V3 extension with four major layers:

1. **Request interception**
   - `clearurls.js`
   - `core_js/linkumori_url_filter_runtime.js`
   - `core_js/linkumori_dns.js`
   - `core_js/eTagFilter.js`
   - `core_js/historyListener.js`

2. **Rules and state**
   - `core_js/storage.js`
   - bundled compressed data under `data/`
   - custom providers and removeparam rules
   - optional remote rule sources

3. **Matching engines**
   - provider engine in `clearurls.js`
   - interoperability parser in `core_js/linkumori_url_filter_interoperability.js`
   - URL filter runtime in `core_js/linkumori_url_filter_runtime.js`
   - trie helpers in `core_js/linkumori_hntrie.js` and `core_js/linkumori_biditrie.js`

4. **User-facing surfaces**
   - popup
   - settings
   - custom-rules editor
   - logger
   - audit page
   - cleaning tool

## Why The Repo Feels Fast

The hot path is built around candidate reduction:

- providers are indexed by hostname-like lookup tokens
- removeparam rules are indexed by selected request tokens
- domain include/exclude decisions use tries
- runtime bails out early for irrelevant requests
- rule data ships compressed and optimized structures can be cached

That means Linkumori usually evaluates a small set of plausible matches instead of scanning all rules.

## Where To Go Next

- If you want to understand **how a request is cleaned**, read [Runtime Pipeline](./runtime-pipeline.md).
- If you want to understand **how rule data is loaded and merged**, read [Rules, Storage, and Data](./rules-storage-data.md).
- If you want the **current implemented rule grammar**, read [Current Rule Syntax](./current-rule-syntax.md).
- If you want to know **which file owns what**, read [Module Reference](./module-reference.md).
