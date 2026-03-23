# Permissions

This page describes all permissions used by Linkumori and the purpose for which they are used.

---

## `<all_urls>`

Required to perform URL cleaning on all pages regardless of protocol (HTTPS, HTTP, data, etc.), ensuring that tracking parameters are removed from every network request the browser makes.

---

## `webRequest` and `webRequestBlocking`

Required to intercept browser requests before they are sent. `webRequest` provides notification of outgoing requests, while `webRequestBlocking` allows the extension to synchronously modify or cancel them. The cleaned URL is then passed back to the browser.

---

## `storage`

Required to persist user settings, logs, rules, and the whitelist across browser sessions. This includes all feature toggles, the activity log, and any custom rules or whitelist entries you have configured.

---
## `alarms`

Required to keep the extension running reliably in the background. The browser may suspend or shut down extension background processes to conserve memory and resources. This permission allows Linkumori to schedule periodic wake-up signals, ensuring the extension remains active and vigilant at all times. If the extension is ever suspended or stops functioning unexpectedly, the alarm will trigger a automatic reboot, restoring full protection without any action required from you.

---
## `unlimitedStorage`

Required to exceed the 5MB quota that browsers impose on extension storage by default. Without this, the activity log would quickly fill the storage limit and render the addon unusable. This permission may become optional in a future release.

---

## `activeTab`

Required for popup whitelist management. When you open the extension popup, this permission grants temporary access to your currently active tab's URL, allowing the popup to display your current domain and offer a one-click button to add or remove it from your whitelist. Access is only granted at the moment you interact with the extension, making it a privacy-respecting choice for this specific use case.

---

## `tabs`

Required for context-aware whitelisting. The extension tracks which URL each tab is currently showing in the background, so that subrequests originating from a whitelisted page are also correctly bypassed, even if the subrequest URL itself is not whitelisted.

---

## `webNavigation`

Required to track individual frames within a tab, such as iframes and nested subframes, as well as page navigations that happen without a full reload. Because a single tab can contain multiple nested frames each with their own URL, this permission allows the extension to walk the full frame ancestor chain and apply whitelist checks correctly across the entire page context.

---

## `contextMenus`

Required for the **"Copy Clean Link Location"** option that appears when you right-click a link. This strips tracking parameters from the link URL before copying it to your clipboard, without needing to navigate to the page first.

---

## `scripting`

Required for two purposes:

- **History API protection** — prevents websites from re-injecting tracking parameters into the URL after the page has loaded. The extension listens for these navigation events and undoes the change. If you do not want this behaviour, you can disable it in settings using the **"Prevent tracking injection over history API"** toggle, followed by **"Save & reload"**.

- **Clipboard access for context menu** — when you use the **"Copy Clean Link Location"** context menu option, the extension needs to access your clipboard to copy the cleaned URL. Without this permission, the extension has no way to write to your clipboard on your behalf.

---

## `downloads`

Required to export your activity logs and settings to a file on your device. This permission may become optional in a future release.

