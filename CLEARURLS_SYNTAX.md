# ClearURLs JSON Writing Guide

This guide explains how to write JSON provider data that `clearurls.js` can read.

It is not a guide to the JavaScript code. It focuses only on the JSON shapes, rule formats, and examples that rule authors need.

## Chapter 1: Basic JSON Shape

`clearurls.js` expects provider data in this general shape:

```json
{
  "providers": {
    "Example Provider": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

The important part is `providers`. Each key inside `providers` is a provider name.

Example:

```json
{
  "providers": {
    "Google": {},
    "Amazon": {},
    "Example Tracker": {}
  }
}
```

## Chapter 2: What Is A Provider?

A provider is one group of rules for one website, company, tracker, or URL pattern.

Minimal provider:

```json
{
  "providers": {
    "Example": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source", "utm_medium"]
    }
  }
}
```

What this does:

```txt
https://example.com/page?utm_source=x&utm_medium=y&id=10
-> https://example.com/page?id=10
```

## Chapter 3: Provider Fields You Can Use

Full provider template:

```json
{
  "providers": {
    "Provider Name": {
      "active": true,
      "defaultActive": true,
      "completeProvider": false,
      "forceRedirection": false,

      "domainPatterns": ["||example.com^"],
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/.*",
      "indexPattern": "||example.com^",

      "rules": [],
      "rawRules": [],
      "referralMarketing": [],
      "exceptions": [],
      "domainExceptions": [],
      "redirections": [],
      "domainRedirections": [],

      "methods": ["GET"],
      "resourceTypes": ["main_frame", "xmlhttprequest"]
    }
  }
}
```

Plain meaning:

| JSON field | What you write it for |
| --- | --- |
| `active` | Set `false` to disable this provider. |
| `defaultActive` | Default active state when `active` is missing. |
| `completeProvider` | Set `true` to block matching domains instead of only cleaning. |
| `forceRedirection` | Set `true` to force main-page redirects through the browser tab. |
| `domainPatterns` | Recommended way to say which domains this provider matches. |
| `urlPattern` | JavaScript regex string for URL matching. |
| `indexPattern` | Optional speed hint when using `urlPattern`. |
| `rules` | Normal parameter-removal rules and `$removeparam` rules. |
| `rawRules` | Rules that edit the whole URL text. |
| `referralMarketing` | Optional referral/marketing parameter rules. |
| `exceptions` | URL regex rules where this provider should not run. |
| `domainExceptions` | Domain-pattern rules where this provider should not run. |
| `redirections` | Regex redirect rules. |
| `domainRedirections` | Domain-pattern redirect rules. |
| `methods` | Only run for these HTTP methods. |
| `resourceTypes` | Only run for these browser request types. |

## Chapter 4: Matching Domains

Use `domainPatterns` for most JSON providers.

### Match One Domain And All Subdomains

```json
{
  "domainPatterns": ["||example.com^"]
}
```

Matches:

```txt
https://example.com/
https://www.example.com/
https://shop.example.com/
```

Does not match:

```txt
https://badexample.com/
https://example.com.evil.test/
```

### Match The Same Name On Any Public Suffix

```json
{
  "domainPatterns": ["||amazon.*^"]
}
```

Can match:

```txt
https://amazon.com/
https://amazon.co.uk/
https://amazon.in/
```

### Match Subdomains

```json
{
  "domainPatterns": ["*.google.com"]
}
```

Can match:

```txt
https://mail.google.com/
https://maps.google.com/
```

### Use More Than One Domain Pattern

```json
{
  "domainPatterns": [
    "||youtube.com^",
    "||youtu.be^"
  ]
}
```

## Chapter 5: Domain Pattern Symbols

These are the symbols you can use in `domainPatterns`.

| Symbol | Meaning | Example |
| --- | --- | --- |
| `||` | Match at a domain boundary. | `||example.com^` |
| `^` | Separator or end boundary. | `||example.com^` |
| `*` | Wildcard. | `||example.*^` |
| `|` | Start or end anchor. | `|https://example.com` |
| `/.../i` | JavaScript regex literal. | `/tracker/i` |

Most common pattern:

```txt
||example.com^
```

Use it when you want:

```txt
example.com + all subdomains
```

## Chapter 6: Matching URLs With `urlPattern`

Use `urlPattern` only when domain matching is not enough.

```json
{
  "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/tracking\\/.*"
}
```

This can match:

```txt
https://example.com/tracking/page
https://sub.example.com/tracking/page
```

When you use `urlPattern`, add `indexPattern` if possible so the engine can find the provider faster.

```json
{
  "urlPattern": "https?:\\/\\/([^/]+\\.)?youtube\\.com\\/watch.*",
  "indexPattern": ["||youtube.com^", "||youtu.be^"]
}
```

Important: `indexPattern` is only a lookup hint. It does not decide whether the provider applies.

## Chapter 7: Remove Simple Query Parameters

Put parameter names in `rules`.

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

Result:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

Remove many parameters:

```json
{
  "rules": [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "fbclid",
    "gclid"
  ]
}
```

Result:

```txt
https://example.com/?utm_source=x&fbclid=y&id=1
-> https://example.com/?id=1
```

## Chapter 8: Write A Rule Object

Instead of a plain string, a rule can be an object.

```json
{
  "id": "remove-utm-source",
  "kind": "field",
  "match": "utm_source",
  "active": true,
  "action": {
    "type": "remove"
  },
  "flags": "i"
}
```

Use this when you need:

- A rule ID.
- Aliases.
- Exceptions.
- Request type limits.
- Rewrite behavior.

Example inside a provider:

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "remove-utm-source",
          "kind": "field",
          "match": "utm_source",
          "action": {
            "type": "remove"
          },
          "flags": "i"
        }
      ]
    }
  }
}
```

Result:

```txt
https://example.com/?UTM_SOURCE=x&id=1
-> https://example.com/?id=1
```

`flags: "i"` makes the match case-insensitive.

## Chapter 9: `$removeparam` Rules

`clearurls.js` can read `$removeparam` rules inside `rules`.

### Remove One Parameter

```json
{
  "rules": ["*$removeparam=utm_source"]
}
```

Result:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

### Remove All Parameters

```json
{
  "rules": ["*$removeparam"]
}
```

Result:

```txt
https://example.com/?a=1&b=2
-> https://example.com/
```

### Remove Parameters By Regex

```json
{
  "rules": ["*$removeparam=/^utm_/"]
}
```

Result:

```txt
https://example.com/?utm_source=x&utm_campaign=y&id=1
-> https://example.com/?id=1
```

### Remove All Except One Parameter

```json
{
  "rules": ["*$removeparam=~id"]
}
```

Result:

```txt
https://example.com/?id=1&utm_source=x&fbclid=y
-> https://example.com/?id=1
```

### Apply `$removeparam` Only To One Domain

```json
{
  "rules": ["||example.com^$removeparam=utm_source"]
}
```

Cleaned:

```txt
https://example.com/?utm_source=x&id=1
-> https://example.com/?id=1
```

Not cleaned:

```txt
https://other.test/?utm_source=x&id=1
```

### Add Domain Limits

```json
{
  "rules": ["*$removeparam=utm_source,domain=example.com|shop.example.com"]
}
```

Exclude one domain:

```json
{
  "rules": ["*$removeparam=utm_source,domain=example.com|~safe.example.com"]
}
```

### Add Method Limits

Only `GET`:

```json
{
  "rules": ["*$removeparam=utm_source,method=GET"]
}
```

Not `POST`:

```json
{
  "rules": ["*$removeparam=utm_source,method=~POST"]
}
```

## Chapter 10: `$removeparam` Exceptions

Start a `$removeparam` rule with `@@` to make an exception.

```json
{
  "rules": [
    "*$removeparam=utm_source",
    "@@||example.com^$removeparam=utm_source"
  ]
}
```

Result:

```txt
https://other.test/?utm_source=x&id=1
-> https://other.test/?id=1

https://example.com/?utm_source=x&id=1
-> https://example.com/?utm_source=x&id=1
```

Context exception example:

```json
{
  "rules": ["@@||gemini.google.com^$removeparam=ei"]
}
```

This can protect `ei` on subrequests started by a `gemini.google.com` page.

## Chapter 11: Rewrite Parameter Values

Use `action.type: "rewrite"` to replace a matching parameter value.

```json
{
  "id": "normalize-tag",
  "kind": "field",
  "match": "tag",
  "action": {
    "type": "rewrite",
    "replacePattern": "clean"
  }
}
```

Inside a provider:

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "normalize-tag",
          "kind": "field",
          "match": "tag",
          "action": {
            "type": "rewrite",
            "replacePattern": "clean"
          }
        }
      ]
    }
  }
}
```

Result:

```txt
https://example.com/?tag=tracking&id=1
-> https://example.com/?id=1&tag=clean
```

Use `§1§` when you want to reuse the current value:

```json
{
  "id": "keep-decoded-target",
  "kind": "field",
  "match": "target",
  "action": {
    "type": "rewrite",
    "replacePattern": "§1§"
  },
  "preprocessors": [
    {
      "type": "urlDecode",
      "inputs": [1]
    }
  ]
}
```

## Chapter 12: Raw Rules

Use `rawRules` to edit the whole URL text.

Simple raw rule:

```json
{
  "rawRules": ["[?&]utm_source=[^&#]*"]
}
```

Result:

```txt
https://example.com/page?id=1&utm_source=x
-> https://example.com/page?id=1
```

Object raw rule:

```json
{
  "rawRules": [
    {
      "id": "strip-utm-source-raw",
      "kind": "raw",
      "match": "[?&]utm_source=[^&#]*",
      "action": {
        "type": "remove"
      },
      "flags": "gi"
    }
  ]
}
```

Raw rewrite rule:

```json
{
  "rawRules": [
    {
      "id": "rewrite-tracker-target",
      "kind": "raw",
      "match": "https://tracker\\.example/redirect\\?url=([^&#]+)",
      "action": {
        "type": "rewrite",
        "replacePattern": "§1§"
      },
      "preprocessors": [
        {
          "type": "urlDecode",
          "inputs": [1]
        }
      ]
    }
  ]
}
```

Result:

```txt
https://tracker.example/redirect?url=https%3A%2F%2Freal.example%2Fpage
-> https://real.example/page
```

## Chapter 13: Redirect Rules

Use `redirections` to send the browser to a new URL.

```json
{
  "redirections": [
    {
      "id": "tracker-target",
      "kind": "redirection",
      "match": "https://tracker\\.example/click\\?target=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      },
      "preprocessors": [
        {
          "type": "urlDecode",
          "inputs": [1]
        }
      ]
    }
  ]
}
```

Result:

```txt
https://tracker.example/click?target=https%3A%2F%2Fnews.example%2Fstory
-> https://news.example/story
```

If `replacePattern` is missing, the first capture group is used.

## Chapter 14: Domain Redirect Rules

Use `domainRedirections` for simple domain-pattern redirects.

String form:

```json
{
  "domainRedirections": [
    "||tracker.example^$redirect=https://real.example/"
  ]
}
```

Object form:

```json
{
  "domainRedirections": [
    {
      "match": "||tracker.example^",
      "action": {
        "replacePattern": "https://real.example/"
      }
    }
  ]
}
```

## Chapter 15: Exceptions

Use `exceptions` when a provider should skip specific URL patterns.

```json
{
  "exceptions": [
    {
      "id": "keep-login",
      "match": "example\\.com\\/login",
      "active": true
    }
  ]
}
```

Example:

```txt
Provider cleans:
https://example.com/page?utm_source=x

Provider skips:
https://example.com/login?utm_source=x
```

Use `domainExceptions` for domain-pattern exceptions.

```json
{
  "domainExceptions": ["||safe.example.com^"]
}
```

Skipped:

```txt
https://safe.example.com/?utm_source=x
```

## Chapter 16: Referral Marketing Rules

`referralMarketing` works like field rules, but it is controlled by the extension setting for referral marketing.

```json
{
  "referralMarketing": [
    "tag",
    "ascsubtag"
  ]
}
```

Example:

```txt
https://example.com/product?tag=affiliate&id=10
-> https://example.com/product?id=10
```

## Chapter 17: HTTP Methods

Use `methods` to run a provider only on specific HTTP methods.

```json
{
  "methods": ["GET"]
}
```

This runs on:

```txt
GET
```

This does not run on:

```txt
POST
PUT
DELETE
```

## Chapter 18: Browser Resource Types

Use `resourceTypes` to run only on specific browser request types.

```json
{
  "resourceTypes": ["main_frame", "xmlhttprequest"]
}
```

Common values:

```txt
main_frame
sub_frame
xmlhttprequest
script
image
stylesheet
ping
```

Example:

```json
{
  "providers": {
    "API Cleaner": {
      "domainPatterns": ["||api.example.com^"],
      "resourceTypes": ["xmlhttprequest"],
      "rules": ["tracking_id"]
    }
  }
}
```

Meaning:

```txt
Remove tracking_id from fetch/XHR requests to api.example.com.
```

## Chapter 19: Preprocessors

Preprocessors change captured values before using them in `replacePattern`.

Example:

```json
{
  "preprocessors": [
    {
      "type": "urlDecode",
      "inputs": [1]
    }
  ]
}
```

Supported types:

```txt
urlEncode
urlDecode
doubleUrlEncode
urlEncodeRepeated
doubleUrlDecode
urlDecodeRepeated
base64Encode
base64Decode
```

`inputs` can be:

```json
[1]
```

```json
[1, 2]
```

```json
"all"
```

## Chapter 20: Rule IDs And Aliases

Give important rules an `id`.

```json
{
  "id": "remove-utm-source",
  "kind": "field",
  "match": "utm_source",
  "action": {
    "type": "remove"
  }
}
```

Add aliases when an old ID should still work:

```json
{
  "id": "remove-utm-source",
  "aliases": ["utm-source-old"],
  "kind": "field",
  "match": "utm_source",
  "action": {
    "type": "remove"
  }
}
```

The engine can disable this rule by these names:

```txt
Provider Name::remove-utm-source
remove-utm-source
Provider Name::utm-source-old
utm-source-old
```

## Chapter 21: Defaults

The JSON can include global defaults.

```json
{
  "defaults": {
    "active": true,
    "description": "Default rule",
    "requestTypes": "all",
    "preprocessors": [],
    "exceptions": []
  },
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

Rules can inherit these default fields when they do not define their own values.

## Chapter 22: Allowed JSON Combinations

This chapter shows how different JSON forms can exist together in one rules file.

### Combination 1: Many Providers In One File

You can define many providers under `providers`.

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    },
    "Shop": {
      "domainPatterns": ["||shop.test^"],
      "rules": ["fbclid"]
    },
    "Tracker Redirect": {
      "domainPatterns": ["||tracker.test^"],
      "redirections": [
        {
          "kind": "redirection",
          "match": "https://tracker\\.test/click\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        }
      ]
    }
  }
}
```

Each provider is loaded separately.

### Combination 2: Global Defaults Plus Providers

`defaults` can exist beside `providers`.

```json
{
  "defaults": {
    "active": true,
    "requestTypes": "all",
    "preprocessors": []
  },
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "remove-utm-source",
          "kind": "field",
          "match": "utm_source",
          "action": {
            "type": "remove"
          }
        }
      ]
    }
  }
}
```

Rules can inherit default values when those fields are missing on the rule.

### Combination 3: `domainPatterns` Provider

Most providers should use this form.

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

### Combination 4: `urlPattern` Provider With `indexPattern`

Use this when you need regex URL matching.

```json
{
  "providers": {
    "Example Tracking Path": {
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/tracking\\/.*",
      "indexPattern": "||example.com^",
      "rules": ["utm_source"]
    }
  }
}
```

`indexPattern` is optional, but useful for speed.

### Combination 5: `domainPatterns` And `urlPattern` Together

This shape is valid JSON:

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "urlPattern": "https?:\\/\\/example\\.com\\/special\\/.*",
      "rules": ["utm_source"]
    }
  }
}
```

Important behavior:

```txt
If domainPatterns exists and is not empty, clearurls.js uses domainPatterns for provider matching.
urlPattern is only used when domainPatterns is missing or empty.
```

So do not use both when you expect both to be required. If you need a path condition, use `urlPattern` with `indexPattern`, or put a scoped `$removeparam`/rule pattern inside `rules`.

### Combination 6: Mixed `rules[]` Entries

`rules` can contain plain strings, `$removeparam` strings, legacy objects, and canonical objects together.

```json
{
  "providers": {
    "Mixed Rules": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        "utm_source",
        "*$removeparam=fbclid",
        {
          "id": "remove-gclid",
          "matchPattern": "gclid",
          "active": true
        },
        {
          "id": "remove-msclkid",
          "kind": "field",
          "match": "msclkid",
          "action": {
            "type": "remove"
          }
        }
      ]
    }
  }
}
```

All four entries are accepted.

### Combination 7: Canonical Objects Inside `rules[]`

Canonical objects can represent different kinds of rule.

```json
{
  "providers": {
    "Canonical Mixed": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "field-rule",
          "kind": "field",
          "match": "utm_source",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "raw-rule",
          "kind": "raw",
          "match": "[?&]utm_medium=[^&#]*",
          "action": {
            "type": "remove"
          },
          "flags": "gi"
        },
        {
          "id": "redirect-rule",
          "kind": "redirection",
          "match": "https://example\\.com/out\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        },
        {
          "id": "referral-rule",
          "kind": "field",
          "match": "tag",
          "referralMarketing": true,
          "action": {
            "type": "remove"
          }
        }
      ]
    }
  }
}
```

`clearurls.js` sorts these by meaning:

```txt
kind: "raw"          -> raw rule behavior
kind: "redirection"  -> redirection behavior
referralMarketing    -> referral marketing behavior
everything else      -> field rule behavior
```

### Combination 8: Legacy Arrays Plus Canonical `rules[]`

You can still use classic provider arrays.

```json
{
  "providers": {
    "Legacy Plus Canonical": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        "utm_source",
        {
          "id": "canonical-field",
          "kind": "field",
          "match": "fbclid",
          "action": {
            "type": "remove"
          }
        }
      ],
      "rawRules": [
        "[?&]legacy_raw=[^&#]*"
      ],
      "referralMarketing": [
        "tag"
      ],
      "exceptions": [
        "example\\.com\\/keep"
      ],
      "redirections": [
        {
          "id": "legacy-redirection",
          "match": "https://example\\.com/out\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        }
      ]
    }
  }
}
```

This is valid. The engine reads all these arrays for the same provider.

### Combination 9: Provider-Wide Methods And Resource Types

`methods` and `resourceTypes` apply to the whole provider.

```json
{
  "providers": {
    "XHR GET Cleaner": {
      "domainPatterns": ["||api.example.com^"],
      "methods": ["GET"],
      "resourceTypes": ["xmlhttprequest"],
      "rules": ["tracking_id"],
      "rawRules": ["[?&]debug_tracking=[^&#]*"]
    }
  }
}
```

Both `rules` and `rawRules` are limited by the provider method/type match.

### Combination 10: Rule-Level Request Types

Individual canonical rules can also define request types.

```json
{
  "providers": {
    "Mixed Request Types": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "main-frame-only",
          "kind": "field",
          "match": "utm_source",
          "requestTypes": ["main_frame"],
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "xhr-only",
          "kind": "field",
          "match": "tracking_id",
          "requestTypes": ["xmlhttprequest"],
          "action": {
            "type": "remove"
          }
        }
      ]
    }
  }
}
```

Provider-level `resourceTypes` narrows the provider first. Rule-level `requestTypes` narrows individual rules after that.

### Combination 11: Exceptions In Different Places

You can combine provider exceptions, domain exceptions, rule exceptions, and `$removeparam` exceptions.

```json
{
  "providers": {
    "Exception Mix": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        "utm_source",
        "*$removeparam=fbclid",
        "@@||example.com/login^$removeparam=fbclid",
        {
          "id": "rule-with-own-exception",
          "kind": "field",
          "match": "gclid",
          "exceptions": ["example\\.com\\/checkout"],
          "action": {
            "type": "remove"
          }
        }
      ],
      "exceptions": [
        "example\\.com\\/account"
      ],
      "domainExceptions": [
        "||safe.example.com^"
      ]
    }
  }
}
```

Plain meaning:

```txt
Provider exceptions skip the whole provider for matching URLs.
Domain exceptions skip the whole provider for matching domains.
Rule exceptions skip only that rule.
@@ $removeparam exceptions skip matching $removeparam removal.
```

### Combination 12: Blocking Provider Plus Rules

`completeProvider: true` marks a provider as canceling/blocking.

```json
{
  "providers": {
    "Blocked Tracker": {
      "completeProvider": true,
      "domainPatterns": ["||badtracker.example^"],
      "rules": ["utm_source"]
    }
  }
}
```

When domain blocking is enabled in settings, matching requests can be blocked. Rules may still exist, but blocking is the stronger behavior for that provider.

### Combination 13: Redirect Provider Plus Cleanup Rules

A provider can contain redirects and cleanup rules.

```json
{
  "providers": {
    "Redirect And Clean": {
      "domainPatterns": ["||tracker.example^"],
      "redirections": [
        {
          "id": "unwrap-url",
          "kind": "redirection",
          "match": "https://tracker\\.example/click\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          },
          "preprocessors": [
            {
              "type": "urlDecode",
              "inputs": [1]
            }
          ]
        }
      ],
      "rules": ["utm_source", "fbclid"]
    }
  }
}
```

If a redirection matches, the redirect is returned first.

### Combination 14: Domain Redirections Plus Regex Redirections

Both can exist in one provider.

```json
{
  "providers": {
    "Two Redirect Styles": {
      "domainPatterns": ["||tracker.example^"],
      "redirections": [
        {
          "id": "regex-redirect",
          "kind": "redirection",
          "match": "https://tracker\\.example/out\\?to=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        }
      ],
      "domainRedirections": [
        "||tracker.example^$redirect=https://example.com/"
      ]
    }
  }
}
```

Regex redirections are checked first. Domain redirections are checked if no regex redirection matched.

### Combination 15: Disabled Or Inactive Rules

Providers can be inactive:

```json
{
  "providers": {
    "Disabled Provider": {
      "active": false,
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

Rules can be inactive:

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "inactive-rule",
          "kind": "field",
          "match": "utm_source",
          "active": false,
          "action": {
            "type": "remove"
          }
        }
      ]
    }
  }
}
```

Inactive providers and inactive rules are ignored.

### Combination 16: Full Mixed Provider Example

This example intentionally combines most supported provider features.

```json
{
  "defaults": {
    "active": true,
    "requestTypes": "all"
  },
  "providers": {
    "Full Mixed Example": {
      "active": true,
      "domainPatterns": [
        "||example.com^",
        "||example.org^"
      ],
      "methods": ["GET", "HEAD"],
      "resourceTypes": ["main_frame", "xmlhttprequest"],
      "rules": [
        "utm_source",
        "*$removeparam=fbclid",
        "@@||example.com/login^$removeparam=fbclid",
        {
          "id": "remove-gclid",
          "kind": "field",
          "match": "gclid",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "canonical-raw-in-rules",
          "kind": "raw",
          "match": "[?&]raw_tracking=[^&#]*",
          "action": {
            "type": "remove"
          },
          "flags": "gi"
        }
      ],
      "rawRules": [
        "[?&]legacy_raw=[^&#]*"
      ],
      "referralMarketing": [
        "tag"
      ],
      "exceptions": [
        "example\\.com\\/account"
      ],
      "domainExceptions": [
        "||safe.example.com^"
      ],
      "redirections": [
        {
          "id": "unwrap-outbound",
          "kind": "redirection",
          "match": "https://example\\.com/out\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          },
          "preprocessors": [
            {
              "type": "urlDecode",
              "inputs": [1]
            }
          ]
        }
      ],
      "domainRedirections": [
        "||old.example.com^$redirect=https://example.com/"
      ]
    }
  }
}
```

This is a valid mixed Linkumori/ClearURLs provider style.

## Chapter 23: Legacy, Canonical, And Mixed Form Matrix

This chapter is the full compatibility map for authoring JSON. It shows the old ClearURLs-style forms, the newer canonical forms, and the mixed forms that can exist together.

### Top-Level File Forms

Minimal ClearURLs-style source:

```json
{
  "providers": {
    "Example": {
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/.*",
      "rules": ["utm_source"]
    }
  }
}
```

Linkumori extended source with defaults:

```json
{
  "defaults": {
    "active": true,
    "requestTypes": "all"
  },
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

Unified source with provider JSON plus interoperability rules:

```json
{
  "providers": {
    "Example": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  },
  "urlFilterRules": [
    "*$removeparam=fbclid"
  ],
  "urlFilterMetadata": {
    "format": "linkumori-url-filter-interoperability",
    "status": "loaded"
  }
}
```

Important:

```txt
providers are handled by clearurls.js provider logic.
urlFilterRules are handled by the interoperability runtime.
They can exist in the same ClearURLsData object, but they are different rule systems.
```

### Provider Matcher Forms

Legacy `urlPattern` only:

```json
{
  "providers": {
    "Legacy URL Regex Provider": {
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/.*",
      "rules": ["utm_source"]
    }
  }
}
```

Legacy `urlPattern` with `indexPattern`:

```json
{
  "providers": {
    "Indexed URL Regex Provider": {
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/tracking\\/.*",
      "indexPattern": "||example.com^",
      "rules": ["utm_source"]
    }
  }
}
```

Multiple `indexPattern` hints:

```json
{
  "providers": {
    "Multi Host URL Regex Provider": {
      "urlPattern": "https?:\\/\\/(www\\.)?(youtube\\.com|youtu\\.be)\\/.*",
      "indexPattern": ["||youtube.com^", "||youtu.be^"],
      "rules": ["feature"]
    }
  }
}
```

Linkumori `domainPatterns` only:

```json
{
  "providers": {
    "Domain Pattern Provider": {
      "domainPatterns": ["||example.com^"],
      "rules": ["utm_source"]
    }
  }
}
```

Multiple `domainPatterns`:

```json
{
  "providers": {
    "Multi Domain Provider": {
      "domainPatterns": ["||example.com^", "||example.org^", "||example.net^"],
      "rules": ["utm_source"]
    }
  }
}
```

Regex inside `domainPatterns`:

```json
{
  "providers": {
    "Regex Domain Pattern Provider": {
      "domainPatterns": ["/^https?:\\/\\/([^/]+\\.)?example\\.com\\/special/i"],
      "rules": ["utm_source"]
    }
  }
}
```

Both `domainPatterns` and `urlPattern`:

```json
{
  "providers": {
    "Both Matcher Fields": {
      "domainPatterns": ["||example.com^"],
      "urlPattern": "https?:\\/\\/example\\.com\\/special\\/.*",
      "rules": ["utm_source"]
    }
  }
}
```

Behavior:

```txt
domainPatterns wins for matching when it is present and non-empty.
urlPattern is used only when domainPatterns is missing or empty.
```

### Provider State Forms

Active provider:

```json
{
  "active": true,
  "domainPatterns": ["||example.com^"],
  "rules": ["utm_source"]
}
```

Inactive provider:

```json
{
  "active": false,
  "domainPatterns": ["||example.com^"],
  "rules": ["utm_source"]
}
```

Default-active provider:

```json
{
  "defaultActive": true,
  "domainPatterns": ["||example.com^"],
  "rules": ["utm_source"]
}
```

Complete/blocking provider:

```json
{
  "completeProvider": true,
  "domainPatterns": ["||badtracker.example^"]
}
```

Complete provider with cleanup rules:

```json
{
  "completeProvider": true,
  "domainPatterns": ["||badtracker.example^"],
  "rules": ["utm_source"],
  "rawRules": ["[?&]bad=[^&#]*"]
}
```

Force-redirection provider:

```json
{
  "forceRedirection": true,
  "domainPatterns": ["||tracker.example^"],
  "redirections": [
    {
      "match": "https://tracker\\.example/out\\?url=([^&#]+)"
    }
  ]
}
```

### `rules[]` Entry Forms

Plain legacy field string:

```json
{
  "rules": ["utm_source"]
}
```

Plain regex field string:

```json
{
  "rules": ["^utm_"]
}
```

Inline `$removeparam` rule:

```json
{
  "rules": ["*$removeparam=utm_source"]
}
```

Inline `$removeparam` exception:

```json
{
  "rules": ["@@||example.com^$removeparam=utm_source"]
}
```

Legacy object with `matchPattern`:

```json
{
  "rules": [
    {
      "id": "legacy-object-rule",
      "matchPattern": "utm_source",
      "active": true,
      "flags": "i"
    }
  ]
}
```

Canonical field object:

```json
{
  "rules": [
    {
      "id": "canonical-field-rule",
      "kind": "field",
      "match": "utm_source",
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

Canonical field rewrite object:

```json
{
  "rules": [
    {
      "id": "canonical-field-rewrite",
      "kind": "field",
      "match": "tag",
      "action": {
        "type": "rewrite",
        "replacePattern": "clean"
      }
    }
  ]
}
```

Canonical raw object inside `rules[]`:

```json
{
  "rules": [
    {
      "id": "raw-inside-rules",
      "kind": "raw",
      "match": "[?&]utm_source=[^&#]*",
      "action": {
        "type": "remove"
      },
      "flags": "gi"
    }
  ]
}
```

Canonical redirection object inside `rules[]`:

```json
{
  "rules": [
    {
      "id": "redirect-inside-rules",
      "kind": "redirection",
      "match": "https://tracker\\.example/click\\?url=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      }
    }
  ]
}
```

Canonical referral-marketing object inside `rules[]`:

```json
{
  "rules": [
    {
      "id": "referral-inside-rules",
      "kind": "field",
      "match": "tag",
      "referralMarketing": true,
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

All `rules[]` forms mixed:

```json
{
  "rules": [
    "utm_source",
    "^utm_",
    "*$removeparam=fbclid",
    "@@||example.com/login^$removeparam=fbclid",
    {
      "id": "legacy-object",
      "matchPattern": "gclid"
    },
    {
      "id": "canonical-field",
      "kind": "field",
      "match": "msclkid",
      "action": {
        "type": "remove"
      }
    },
    {
      "id": "canonical-raw",
      "kind": "raw",
      "match": "[?&]raw_id=[^&#]*",
      "action": {
        "type": "remove"
      }
    },
    {
      "id": "canonical-redirection",
      "kind": "redirection",
      "match": "https://tracker\\.example/\\?url=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      }
    }
  ]
}
```

### `rawRules[]` Entry Forms

Legacy raw string:

```json
{
  "rawRules": ["[?&]utm_source=[^&#]*"]
}
```

Legacy raw object with `matchPattern`:

```json
{
  "rawRules": [
    {
      "id": "legacy-raw-object",
      "matchPattern": "[?&]utm_source=[^&#]*",
      "flags": "gi"
    }
  ]
}
```

Canonical raw object:

```json
{
  "rawRules": [
    {
      "id": "canonical-raw-object",
      "kind": "raw",
      "match": "[?&]utm_source=[^&#]*",
      "action": {
        "type": "remove"
      },
      "flags": "gi"
    }
  ]
}
```

Canonical raw rewrite:

```json
{
  "rawRules": [
    {
      "id": "canonical-raw-rewrite",
      "kind": "raw",
      "match": "https://tracker\\.example/out\\?url=([^&#]+)",
      "action": {
        "type": "rewrite",
        "replacePattern": "§1§"
      },
      "preprocessors": [
        {
          "type": "urlDecode",
          "inputs": [1]
        }
      ]
    }
  ]
}
```

Mixed `rawRules[]`:

```json
{
  "rawRules": [
    "[?&]utm_source=[^&#]*",
    {
      "id": "raw-object",
      "matchPattern": "[?&]fbclid=[^&#]*"
    },
    {
      "id": "canonical-raw",
      "kind": "raw",
      "match": "[?&]gclid=[^&#]*",
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

### `referralMarketing[]` Entry Forms

Legacy referral string:

```json
{
  "referralMarketing": ["tag"]
}
```

Legacy referral object:

```json
{
  "referralMarketing": [
    {
      "id": "legacy-referral-object",
      "matchPattern": "tag"
    }
  ]
}
```

Canonical referral object:

```json
{
  "referralMarketing": [
    {
      "id": "canonical-referral",
      "kind": "field",
      "match": "tag",
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

Mixed referral rules:

```json
{
  "referralMarketing": [
    "tag",
    "ascsubtag",
    {
      "id": "canonical-referral",
      "kind": "field",
      "match": "affid",
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

### `exceptions[]` Entry Forms

Legacy exception string:

```json
{
  "exceptions": ["example\\.com\\/login"]
}
```

Legacy exception object:

```json
{
  "exceptions": [
    {
      "id": "legacy-exception-object",
      "matchPattern": "example\\.com\\/login"
    }
  ]
}
```

Canonical exception object:

```json
{
  "exceptions": [
    {
      "id": "canonical-exception",
      "kind": "field",
      "match": "example\\.com\\/login",
      "action": {
        "type": "remove"
      }
    }
  ]
}
```

Mixed exceptions:

```json
{
  "exceptions": [
    "example\\.com\\/login",
    {
      "id": "checkout-exception",
      "matchPattern": "example\\.com\\/checkout"
    },
    {
      "id": "account-exception",
      "match": "example\\.com\\/account"
    }
  ]
}
```

### `domainExceptions[]` Entry Forms

Domain exceptions are plain domain-pattern strings.

```json
{
  "domainExceptions": [
    "||safe.example.com^",
    "||accounts.example.com^"
  ]
}
```

### `redirections[]` Entry Forms

Legacy redirection string:

```json
{
  "redirections": [
    "https://tracker\\.example/click\\?url=([^&#]+)"
  ]
}
```

With a legacy string, the first capture group is used as the redirect target.

Legacy redirection object:

```json
{
  "redirections": [
    {
      "id": "legacy-redirection-object",
      "matchPattern": "https://tracker\\.example/click\\?url=([^&#]+)",
      "replacePattern": "§1§"
    }
  ]
}
```

Canonical redirection object:

```json
{
  "redirections": [
    {
      "id": "canonical-redirection",
      "kind": "redirection",
      "match": "https://tracker\\.example/click\\?url=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      }
    }
  ]
}
```

Mixed redirections:

```json
{
  "redirections": [
    "https://tracker\\.example/a\\?url=([^&#]+)",
    {
      "id": "legacy-redirection-object",
      "matchPattern": "https://tracker\\.example/b\\?url=([^&#]+)",
      "replacePattern": "§1§"
    },
    {
      "id": "canonical-redirection",
      "kind": "redirection",
      "match": "https://tracker\\.example/c\\?url=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      }
    }
  ]
}
```

### `domainRedirections[]` Entry Forms

String form:

```json
{
  "domainRedirections": [
    "||tracker.example^$redirect=https://example.com/"
  ]
}
```

Object form:

```json
{
  "domainRedirections": [
    {
      "match": "||tracker.example^",
      "replacePattern": "https://example.com/"
    }
  ]
}
```

Object form with nested action:

```json
{
  "domainRedirections": [
    {
      "match": "||tracker.example^",
      "action": {
        "replacePattern": "https://example.com/"
      }
    }
  ]
}
```

Mixed domain redirections:

```json
{
  "domainRedirections": [
    "||tracker-a.example^$redirect=https://example.com/a",
    {
      "match": "||tracker-b.example^",
      "replacePattern": "https://example.com/b"
    },
    {
      "match": "||tracker-c.example^",
      "action": {
        "replacePattern": "https://example.com/c"
      }
    }
  ]
}
```

### Rule Object Field Combinations

Legacy object fields:

```json
{
  "id": "legacy-object",
  "matchPattern": "utm_source",
  "replacePattern": null,
  "flags": "i",
  "active": true,
  "aliases": ["old-id"],
  "exceptions": ["example\\.com\\/keep"],
  "requestTypes": ["main_frame"],
  "preprocessors": []
}
```

Canonical object fields:

```json
{
  "id": "canonical-object",
  "kind": "field",
  "match": "utm_source",
  "active": true,
  "aliases": ["old-id"],
  "description": "Remove utm_source",
  "exceptions": ["example\\.com\\/keep"],
  "requestTypes": ["main_frame"],
  "flags": "i",
  "preprocessors": [],
  "action": {
    "type": "remove"
  }
}
```

Canonical rewrite object:

```json
{
  "id": "rewrite-object",
  "kind": "field",
  "match": "tag",
  "action": {
    "type": "rewrite",
    "replacePattern": "clean"
  }
}
```

Canonical redirect object:

```json
{
  "id": "redirect-object",
  "kind": "redirection",
  "match": "https://tracker\\.example/click\\?url=([^&#]+)",
  "action": {
    "type": "redirect",
    "replacePattern": "§1§"
  },
  "preprocessors": [
    {
      "type": "urlDecode",
      "inputs": [1]
    }
  ]
}
```

### One Provider With Every Legacy Array

```json
{
  "providers": {
    "Every Legacy Array": {
      "active": true,
      "completeProvider": false,
      "forceRedirection": false,
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/.*",
      "indexPattern": "||example.com^",
      "rules": ["utm_source"],
      "rawRules": ["[?&]raw_id=[^&#]*"],
      "referralMarketing": ["tag"],
      "exceptions": ["example\\.com\\/login"],
      "domainExceptions": ["||safe.example.com^"],
      "redirections": ["https://example\\.com/out\\?url=([^&#]+)"],
      "domainRedirections": ["||old.example.com^$redirect=https://example.com/"],
      "methods": ["GET"],
      "resourceTypes": ["main_frame"]
    }
  }
}
```

### One Provider With Every Canonical Style

```json
{
  "providers": {
    "Every Canonical Style": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": [
        {
          "id": "field",
          "kind": "field",
          "match": "utm_source",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "raw",
          "kind": "raw",
          "match": "[?&]raw_id=[^&#]*",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "redirection",
          "kind": "redirection",
          "match": "https://example\\.com/out\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        },
        {
          "id": "referral",
          "kind": "field",
          "match": "tag",
          "referralMarketing": true,
          "action": {
            "type": "remove"
          }
        }
      ],
      "exceptions": [
        {
          "id": "exception",
          "match": "example\\.com\\/login"
        }
      ]
    }
  }
}
```

### Maximum Mixed Compatibility Provider

This is the “everything can coexist” provider shape.

```json
{
  "defaults": {
    "active": true,
    "requestTypes": "all"
  },
  "providers": {
    "Maximum Mixed Compatibility": {
      "active": true,
      "defaultActive": true,
      "completeProvider": false,
      "forceRedirection": false,
      "domainPatterns": ["||example.com^", "||example.org^"],
      "urlPattern": "https?:\\/\\/([^/]+\\.)?example\\.com\\/.*",
      "indexPattern": ["||example.com^", "||example.org^"],
      "methods": ["GET", "HEAD"],
      "resourceTypes": ["main_frame", "xmlhttprequest"],
      "rules": [
        "utm_source",
        "^utm_",
        "*$removeparam=fbclid",
        "@@||example.com/login^$removeparam=fbclid",
        {
          "id": "legacy-field-object",
          "matchPattern": "gclid"
        },
        {
          "id": "canonical-field-object",
          "kind": "field",
          "match": "msclkid",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "canonical-raw-in-rules",
          "kind": "raw",
          "match": "[?&]rule_raw=[^&#]*",
          "action": {
            "type": "remove"
          }
        },
        {
          "id": "canonical-redirect-in-rules",
          "kind": "redirection",
          "match": "https://example\\.com/r\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        }
      ],
      "rawRules": [
        "[?&]legacy_raw=[^&#]*",
        {
          "id": "raw-object",
          "matchPattern": "[?&]raw_object=[^&#]*"
        },
        {
          "id": "canonical-raw-object",
          "kind": "raw",
          "match": "[?&]canonical_raw=[^&#]*",
          "action": {
            "type": "remove"
          }
        }
      ],
      "referralMarketing": [
        "tag",
        {
          "id": "canonical-referral-object",
          "kind": "field",
          "match": "ascsubtag",
          "action": {
            "type": "remove"
          }
        }
      ],
      "exceptions": [
        "example\\.com\\/login",
        {
          "id": "exception-object",
          "matchPattern": "example\\.com\\/checkout"
        },
        {
          "id": "canonical-exception-object",
          "match": "example\\.com\\/account"
        }
      ],
      "domainExceptions": [
        "||safe.example.com^"
      ],
      "redirections": [
        "https://example\\.com/out-a\\?url=([^&#]+)",
        {
          "id": "legacy-redirection-object",
          "matchPattern": "https://example\\.com/out-b\\?url=([^&#]+)",
          "replacePattern": "§1§"
        },
        {
          "id": "canonical-redirection-object",
          "kind": "redirection",
          "match": "https://example\\.com/out-c\\?url=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          }
        }
      ],
      "domainRedirections": [
        "||old-a.example.com^$redirect=https://example.com/a",
        {
          "match": "||old-b.example.com^",
          "replacePattern": "https://example.com/b"
        },
        {
          "match": "||old-c.example.com^",
          "action": {
            "replacePattern": "https://example.com/c"
          }
        }
      ]
    }
  }
}
```

Note:

```txt
This example is for compatibility documentation. In real rule files, keep providers simpler when possible.
```

## Chapter 24: Complete Examples

### Example 1: Basic Tracker Cleaner

```json
{
  "providers": {
    "Example Cleaner": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "fbclid",
        "gclid"
      ]
    }
  }
}
```

Result:

```txt
https://example.com/post?utm_source=x&fbclid=y&id=99
-> https://example.com/post?id=99
```

### Example 2: Remove All UTM Parameters

```json
{
  "providers": {
    "UTM Cleaner": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": [
        "*$removeparam=/^utm_/"
      ]
    }
  }
}
```

Result:

```txt
https://example.com/?utm_source=x&utm_id=y&page=1
-> https://example.com/?page=1
```

### Example 3: Keep A Needed Parameter On Login

```json
{
  "providers": {
    "Example Login Safe Cleaner": {
      "active": true,
      "domainPatterns": ["||example.com^"],
      "rules": [
        "*$removeparam=session_id",
        "@@||example.com/login^$removeparam=session_id"
      ]
    }
  }
}
```

Result:

```txt
https://example.com/page?session_id=abc&id=1
-> https://example.com/page?id=1

https://example.com/login?session_id=abc
-> https://example.com/login?session_id=abc
```

### Example 4: Redirect Tracking Clicks

```json
{
  "providers": {
    "Tracker Redirect": {
      "active": true,
      "domainPatterns": ["||tracker.example^"],
      "redirections": [
        {
          "id": "tracker-target",
          "kind": "redirection",
          "match": "https://tracker\\.example/click\\?target=([^&#]+)",
          "action": {
            "type": "redirect",
            "replacePattern": "§1§"
          },
          "preprocessors": [
            {
              "type": "urlDecode",
              "inputs": [1]
            }
          ]
        }
      ]
    }
  }
}
```

Result:

```txt
https://tracker.example/click?target=https%3A%2F%2Fnews.example%2Fstory
-> https://news.example/story
```

### Example 5: Clean Only API Requests

```json
{
  "providers": {
    "API Cleaner": {
      "active": true,
      "domainPatterns": ["||api.example.com^"],
      "resourceTypes": ["xmlhttprequest"],
      "methods": ["GET"],
      "rules": ["tracking_id"]
    }
  }
}
```

Meaning:

```txt
Only remove tracking_id from GET XHR/fetch requests to api.example.com.
```

## Chapter 25: Quick Copy Templates

Remove one parameter:

```json
{
  "rules": ["utm_source"]
}
```

Remove many parameters:

```json
{
  "rules": ["utm_source", "utm_medium", "fbclid"]
}
```

Use `$removeparam`:

```json
{
  "rules": ["*$removeparam=utm_source"]
}
```

Remove all `utm_` parameters:

```json
{
  "rules": ["*$removeparam=/^utm_/"]
}
```

Add an exception:

```json
{
  "rules": [
    "*$removeparam=utm_source",
    "@@||example.com^$removeparam=utm_source"
  ]
}
```

Match a domain:

```json
{
  "domainPatterns": ["||example.com^"]
}
```

Redirect a tracker URL:

```json
{
  "redirections": [
    {
      "kind": "redirection",
      "match": "https://tracker\\.example/\\?url=([^&#]+)",
      "action": {
        "type": "redirect",
        "replacePattern": "§1§"
      },
      "preprocessors": [
        {
          "type": "urlDecode",
          "inputs": [1]
        }
      ]
    }
  ]
}
```
