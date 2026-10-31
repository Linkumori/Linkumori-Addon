// Every case shown on rules.html, as data. scripts/build-docs.mjs renders each one as a
// card: the input files as JSON, a diagram of what runs, and the resulting JSON.
//
// Results follow core_js/storage.js and the CLN 1.0 spec on main:
// - overload: lists join in load order, built-in first; by default the same text is
//   resolved at run time and inherits the earlier `order`. With order stripping on,
//   provider rules lose `order` before joining and copies that then match are deduped;
//   remote patch replacements still keep their own `order`.
// - custom rules: a provider with the same pattern replaces every base provider on that
//   pattern whole, whatever their methods, resourceTypes, completeProvider or forceRedirection;
// - defaults: written into each file's own rules as it loads, before any merge.
//
// origin: 'builtin' | 'remote' | 'custom' | 'cache'. Rows with `gone: true` are struck out.

const shop = (rules, extra = {}) => ({ domainPatterns: ['||shop.example^'], ...extra, rules });
const amazon = (extra) => ({ domainPatterns: ['||amazon.*^'], ...extra });

export const overloadCases = [
  {
    id: 'ov-own-order',
    title: 'A remote copy with its own order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'token', order: 1 }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'token', order: 50 }]) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', order: 1 }, { matchPattern: 'token', order: 50 }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'order 50, its own' },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: 'The lists join, so both definitions are in the merged provider. At run time the later one, from the remote file, wins whole, including its own order.'
  },
  {
    id: 'ov-inherit',
    title: 'A remote copy without an order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'token', order: 1 }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop(['token']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', order: 1 }, 'token']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'keeps order 1 and the first place' },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: 'The remote copy wins, but it has no order key, so it inherits the built-in order: 1. It also takes the first definition\'s position.'
  },
  {
    id: 'ov-null',
    title: 'Dropping an inherited order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'token', order: 1 }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'token', order: null }]) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', order: 1 }, { matchPattern: 'token', order: null }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'no order' },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: '"order": null means no order, and don\'t inherit one. The rule runs with the unordered entries, at the first definition\'s position.'
  },
  {
    id: 'ov-two-files',
    title: 'Two remote files, both with an order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'token', order: 1 }]) } } },
      { label: 'Remote file 1', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'token', order: 20 }]) } } },
      { label: 'Remote file 2', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'token', order: 30 }]) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', order: 1 }, { matchPattern: 'token', order: 20 }, { matchPattern: 'token', order: 30 }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'order 30, from file 2' },
      { text: 'token', origin: 'remote', note: 'file 1, replaced', gone: true },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: 'Remote files merge in the order you list them, so the last-listed file\'s definition is the last one, and it wins.'
  },
  {
    id: 'ov-two-files-inherit',
    title: 'Two remote files, the last without an order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'token', order: 1 }]) } } },
      { label: 'Remote file 1', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'token', order: 20 }]) } } },
      { label: 'Remote file 2', origin: 'remote', json: { providers: { shop: shop(['token']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', order: 1 }, { matchPattern: 'token', order: 20 }, 'token']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'from file 2, order 20 from file 1' },
      { text: 'token', origin: 'remote', note: 'file 1, replaced', gone: true },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: 'File 2 wins. With no order of its own, it takes the order of the nearest earlier definition that has one: file 1\'s 20.'
  },
  {
    id: 'ov-swap',
    title: 'The same two rules, orders swapped',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'a', order: 1 }, { matchPattern: 'b', order: 2 }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'b', order: 1 }, { matchPattern: 'a', order: 2 }]) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'a', order: 1 }, { matchPattern: 'b', order: 2 }, { matchPattern: 'b', order: 1 }, { matchPattern: 'a', order: 2 }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'b', origin: 'remote', note: 'runs 1st, order 1' },
      { text: 'a', origin: 'remote', note: 'runs 2nd, order 2' }
    ] }],
    explain: 'Each text resolves on its own: the remote a (order 2) and the remote b (order 1) win, so b now runs before a.'
  },
  {
    id: 'ov-same-order',
    title: 'Different rules with the same order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop([{ matchPattern: 'fromBuiltIn', order: 5 }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop([{ matchPattern: 'fromRemote', order: 5 }]) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'fromBuiltIn', order: 5 }, { matchPattern: 'fromRemote', order: 5 }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'fromBuiltIn', origin: 'builtin', note: 'runs 1st' },
      { text: 'fromRemote', origin: 'remote', note: 'runs 2nd' }
    ] }],
    explain: 'Different text, so both run. At equal order, position decides, and built-in entries come first in the joined list.'
  },
  {
    id: 'ov-other-pattern',
    title: 'A different pattern',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { site: { domainPatterns: ['||site.example^'], rules: [{ matchPattern: 'token', order: 1 }] } } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { other: { domainPatterns: ['||other.example^'], rules: [{ matchPattern: 'token', order: 50 }] } } } }
    ],
    merged: {
      site: { domainPatterns: ['||site.example^'], rules: [{ matchPattern: 'token', order: 1 }] },
      other: { domainPatterns: ['||other.example^'], rules: [{ matchPattern: 'token', order: 50 }] }
    },
    runs: [
      { pattern: '||site.example^', rows: [{ text: 'token', origin: 'builtin', note: 'order 1' }] },
      { pattern: '||other.example^', rows: [{ text: 'token', origin: 'remote', note: 'order 50' }] }
    ],
    explain: 'Providers merge only with the same pattern and settings. These stay two providers, each with its own token.'
  },
  {
    id: 'ov-referral',
    title: 'The same text in rules and referralMarketing',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop(['tag']) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: { domainPatterns: ['||shop.example^'], referralMarketing: ['tag'] } } } }
    ],
    merged: { shop: { domainPatterns: ['||shop.example^'], rules: ['tag'], referralMarketing: ['tag'] } },
    runs: [
      { pattern: '||shop.example^', caption: 'Referral marketing not allowed', rows: [
        { text: 'tag', origin: 'remote', note: 'referralMarketing, in the rules entry\'s place' },
        { text: 'tag', origin: 'builtin', note: 'rules, replaced', gone: true }
      ] },
      { pattern: '||shop.example^', caption: 'Referral marketing allowed', rows: [
        { text: 'tag', origin: 'builtin', note: 'rules, runs alone' }
      ] }
    ],
    explain: 'While referral-marketing rules run, the referral entry replaces the field entry with the same text. When you allow referral marketing, only the rules entry runs.'
  }
];

const builtInAmazon = { providers: { amazon: amazon({ rules: ['qid', 'pd_rd_[a-z]*'], referralMarketing: ['tag'] }) } };

export const customCases = [
  {
    id: 'cu-replace',
    title: 'The same pattern',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { amazon: amazon({ rules: ['qid', 'ref_'] }) } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: amazon({ rules: ['qid', 'ref_'] }) },
    runs: [{ pattern: '||amazon.*^', name: 'amazon', origin: 'custom', rows: [
      { text: 'qid', origin: 'custom' },
      { text: 'ref_', origin: 'custom' },
      { text: 'pd_rd_[a-z]*', origin: 'builtin', note: 'no longer removed', gone: true },
      { text: 'tag', origin: 'builtin', note: 'no longer removed', gone: true }
    ] }],
    explain: 'The custom provider replaces the built-in one whole. Its rules are not combined, so the built-in pd_rd_[a-z]* and tag stop running.'
  },
  {
    id: 'cu-methods',
    title: 'The same pattern, different settings',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { 'amazon-get': amazon({ methods: ['GET'], rules: ['ref_'] }) } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { 'amazon-get': amazon({ methods: ['GET'], rules: ['ref_'] }) },
    runs: [{ pattern: '||amazon.*^', name: 'amazon-get', origin: 'custom', note: 'GET only', rows: [
      { text: 'ref_', origin: 'custom' },
      { text: 'qid', origin: 'builtin', note: 'no longer removed', gone: true },
      { text: 'pd_rd_[a-z]*', origin: 'builtin', note: 'no longer removed', gone: true },
      { text: 'tag', origin: 'builtin', note: 'no longer removed', gone: true }
    ] }],
    explain: 'Only the pattern decides. The custom provider replaces the built-in one even though its methods differ, so amazon requests other than GET are no longer cleaned at all.'
  },
  {
    id: 'cu-two-base',
    title: 'Two base providers on the same pattern',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: {
        amazon: builtInAmazon.providers.amazon,
        'amazon-block': { domainPatterns: ['||amazon.*^'], resourceTypes: ['script'], completeProvider: true }
      } } },
      { label: 'Custom rules', origin: 'custom', json: { providers: { amazon: amazon({ rules: ['qid', 'ref_'] }) } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: amazon({ rules: ['qid', 'ref_'] }) },
    runs: [
      { pattern: '||amazon.*^', name: 'amazon', origin: 'custom', rows: [
        { text: 'qid', origin: 'custom' },
        { text: 'ref_', origin: 'custom' },
        { text: 'pd_rd_[a-z]*', origin: 'builtin', note: 'no longer removed', gone: true }
      ] },
      { pattern: '||amazon.*^', name: 'amazon-block', origin: 'off', note: 'replaced too: scripts no longer blocked', rows: [] }
    ],
    explain: 'One custom provider replaces every base provider with its pattern, whatever their settings, including the one that blocks scripts.'
  },
  {
    id: 'cu-pattern',
    title: 'A different pattern',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { 'amazon-de': { domainPatterns: ['||amazon.de^'], rules: ['ref_'] } } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: builtInAmazon.providers.amazon, 'amazon-de': { domainPatterns: ['||amazon.de^'], rules: ['ref_'] } },
    runs: [
      { pattern: '||amazon.*^', name: 'amazon', origin: 'builtin', rows: [{ text: 'qid', origin: 'builtin' }, { text: 'pd_rd_[a-z]*', origin: 'builtin' }, { text: 'tag', origin: 'builtin', note: 'referralMarketing' }] },
      { pattern: '||amazon.de^', name: 'amazon-de', origin: 'custom', rows: [{ text: 'ref_', origin: 'custom' }] }
    ],
    explain: 'Added. On amazon.de both providers match, so both clean the request, one pass after another.'
  },
  {
    id: 'cu-order',
    title: 'The same patterns in another order',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { amazon: { domainPatterns: ['||amazon.*^', '||amzn.to^'], rules: ['qid', 'pd_rd_[a-z]*'] } } } },
      { label: 'Custom rules', origin: 'custom', json: { providers: { amazon: { domainPatterns: ['||amzn.to^', '||amazon.*^'], rules: ['qid'] } } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: { domainPatterns: ['||amzn.to^', '||amazon.*^'], rules: ['qid'] } },
    runs: [{ pattern: '||amazon.*^ ||amzn.to^', name: 'amazon', origin: 'custom', rows: [
      { text: 'qid', origin: 'custom' },
      { text: 'pd_rd_[a-z]*', origin: 'builtin', note: 'no longer removed', gone: true }
    ] }],
    explain: 'Patterns are compared as a set, sorted, so the order you write them in doesn\'t matter. This is the same provider, and it is replaced.'
  },
  {
    id: 'cu-name',
    title: 'A name that is already taken',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { amazon: { domainPatterns: ['||amazon.de^'], rules: ['ref_'] } } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: builtInAmazon.providers.amazon, amazon_1: { domainPatterns: ['||amazon.de^'], rules: ['ref_'] } },
    runs: [
      { pattern: '||amazon.*^', name: 'amazon', origin: 'builtin', rows: [{ text: 'qid', origin: 'builtin' }, { text: 'pd_rd_[a-z]*', origin: 'builtin' }, { text: 'tag', origin: 'builtin', note: 'referralMarketing' }] },
      { pattern: '||amazon.de^', name: 'amazon_1', origin: 'custom', note: 'renamed', rows: [{ text: 'ref_', origin: 'custom' }] }
    ],
    explain: 'Names don\'t decide matching; patterns do. The custom provider is added, and because amazon is taken, it becomes amazon_1.'
  },
  {
    id: 'cu-off',
    title: 'A provider you switched off',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { amazon: amazon({ rules: ['ref_'] }) } } },
      { label: 'Switched off in the editor', origin: 'off', text: 'The provider for ||amazon.*^' }
    ],
    mergedLabel: 'Providers that run',
    merged: {},
    runs: [{ pattern: '||amazon.*^', name: 'amazon', origin: 'off', note: 'switched off', rows: [
      { text: 'qid', origin: 'builtin', gone: true },
      { text: 'ref_', origin: 'custom', gone: true }
    ] }],
    explain: 'Switching a provider off in the custom rules editor removes it from both the base rules and the custom rules, before they are combined.'
  },
  {
    id: 'cu-nopattern',
    title: 'A provider with no pattern',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: builtInAmazon },
      { label: 'Custom rules', origin: 'custom', json: { providers: { broken: { rules: ['utm_extra'] } } } }
    ],
    mergedLabel: 'Providers that run',
    merged: { amazon: builtInAmazon.providers.amazon },
    runs: [
      { pattern: '||amazon.*^', name: 'amazon', origin: 'builtin', rows: [{ text: 'qid', origin: 'builtin' }, { text: 'pd_rd_[a-z]*', origin: 'builtin' }, { text: 'tag', origin: 'builtin', note: 'referralMarketing' }] },
      { pattern: 'no pattern', name: 'broken', origin: 'off', note: 'dropped', rows: [{ text: 'utm_extra', origin: 'custom', gone: true }] }
    ],
    explain: 'Without domainPatterns or urlPattern a provider can\'t match anything, so it is dropped.'
  }
];

export const defaultsCases = [
  {
    id: 'de-different',
    title: 'Each file\'s defaults stay with its rules',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop(['qid']) } } },
      { label: 'Remote file', origin: 'remote', json: { defaults: { requestTypes: ['main_frame'] }, providers: { shop: shop(['psc']) } } }
    ],
    merged: { shop: shop(['qid', { matchPattern: 'psc', requestTypes: ['main_frame'] }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'qid', origin: 'builtin', note: 'every request type' },
      { text: 'psc', origin: 'remote', note: 'page loads only' }
    ] }],
    explain: 'The remote file\'s requestTypes default is written into psc as the file loads. After the merge, only psc carries it.'
  },
  {
    id: 'de-remote-wins',
    title: 'The same rule, the remote file has a default',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop(['token']) } } },
      { label: 'Remote file', origin: 'remote', json: { defaults: { requestTypes: ['main_frame'] }, providers: { shop: shop(['token']) } } }
    ],
    merged: { shop: shop(['token', { matchPattern: 'token', requestTypes: ['main_frame'] }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'page loads only' },
      { text: 'token', origin: 'builtin', note: 'replaced', gone: true }
    ] }],
    explain: 'The remote copy wins whole, and it brings the value its file wrote into it.'
  },
  {
    id: 'de-builtin-default',
    title: 'The same rule, the built-in file has a default',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { defaults: { requestTypes: ['main_frame'] }, providers: { shop: shop(['token']) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop(['token']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'token', requestTypes: ['main_frame'] }, 'token']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'every request type' },
      { text: 'token', origin: 'builtin', note: 'replaced, with its limit', gone: true }
    ] }],
    explain: 'The remote copy wins whole. It has no requestTypes, so the built-in file\'s limit goes with the replaced copy.'
  },
  {
    id: 'de-exceptions',
    title: 'Different exceptions in each file',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { defaults: { exceptions: ['^https:\\/\\/shop\\.example\\/cart'] }, providers: { shop: shop(['a']) } } },
      { label: 'Remote file', origin: 'remote', json: { defaults: { exceptions: ['^https:\\/\\/shop\\.example\\/login'] }, providers: { shop: shop(['b']) } } }
    ],
    merged: { shop: shop([
      { matchPattern: 'a', exceptions: ['^https:\\/\\/shop\\.example\\/cart'] },
      { matchPattern: 'b', exceptions: ['^https:\\/\\/shop\\.example\\/login'] }
    ]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'a', origin: 'builtin', note: 'skips /cart' },
      { text: 'b', origin: 'remote', note: 'skips /login' }
    ] }],
    explain: 'Each file\'s exceptions go into its own rules. Merging never pools them, so a skips only /cart and b only /login.'
  },
  {
    id: 'de-active',
    title: 'A file whose rules are off by default',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { defaults: { active: false }, providers: { shop: shop(['a', { matchPattern: 'c', active: true }]) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop(['b']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'a', active: false }, { matchPattern: 'c', active: true }, 'b']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'c', origin: 'builtin', note: 'sets "active": true itself' },
      { text: 'b', origin: 'remote' },
      { text: 'a', origin: 'builtin', note: 'off by its file\'s default', gone: true }
    ] }],
    explain: '"active": false switches off every rule of its file that doesn\'t say "active": true. The remote file isn\'t affected.'
  },
  {
    id: 'de-own-value',
    title: 'A rule\'s own value beats its file\'s default',
    inputs: [
      { label: 'Remote file', origin: 'remote', json: { defaults: { requestTypes: ['main_frame'] }, providers: { shop: shop([{ matchPattern: 'token', requestTypes: ['script'] }, 'psc']) } } }
    ],
    mergedLabel: 'Rules after loading',
    merged: { shop: shop([{ matchPattern: 'token', requestTypes: ['script'] }, { matchPattern: 'psc', requestTypes: ['main_frame'] }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'token', origin: 'remote', note: 'scripts: its own value' },
      { text: 'psc', origin: 'remote', note: 'page loads: the default' }
    ] }],
    explain: 'A default only fills a key the rule leaves out. token sets requestTypes, so the default doesn\'t touch it.'
  },
  {
    id: 'de-yours',
    title: 'Your defaults for built-in and remote rules',
    inputs: [
      { label: 'Your defaults', origin: 'custom', tag: 'Yours', json: { requestTypes: ['main_frame'] } },
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop(['qid']) } } },
      { label: 'Remote file', origin: 'remote', json: { defaults: { exceptions: ['^https:\\/\\/shop\\.example\\/cart'] }, providers: { shop: shop(['psc']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'qid', requestTypes: ['main_frame'] }, { matchPattern: 'psc', requestTypes: ['main_frame'] }]) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'qid', origin: 'builtin', note: 'page loads: your default' },
      { text: 'psc', origin: 'remote', note: 'page loads; the file\'s /cart exception is ignored' }
    ] }],
    explain: 'With "Yours for built-in and remote rules", both files get your block in place of their own before merging. Custom rules keep their own.'
  },
  {
    id: 'de-edit',
    title: 'You edited a file\'s defaults',
    inputs: [
      { label: 'Remote file', origin: 'remote', json: { defaults: { requestTypes: ['main_frame'] }, providers: { shop: shop(['psc']) } } },
      { label: 'Your edit of this file\'s defaults', origin: 'custom', tag: 'Yours', json: {} }
    ],
    mergedLabel: 'Rules after loading',
    merged: { shop: shop(['psc']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'psc', origin: 'remote', note: 'every request type: your empty block replaced the file\'s' }
    ] }],
    explain: 'An edit replaces the file\'s whole defaults block, and an empty block means no defaults. The file itself doesn\'t change: your edit is kept in the extension, and still applies after the file is updated.'
  },
  {
    id: 'de-history',
    title: 'A provider-level History API setting',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { shop: shop(['a'], { historyBypassProtection: false }) } } },
      { label: 'Remote file', origin: 'remote', json: { providers: { shop: shop(['b']) } } }
    ],
    merged: { shop: shop([{ matchPattern: 'a', historyBypassProtection: false }, 'b']) },
    runs: [{ pattern: '||shop.example^', rows: [
      { text: 'a', origin: 'builtin', note: 'skipped on History API changes' },
      { text: 'b', origin: 'remote', note: 'runs on History API changes too' }
    ] }],
    explain: 'The merged provider can hold only one value, so the built-in provider\'s setting is copied onto its own rule first.'
  },
  {
    id: 'de-complete',
    title: 'A complete provider with a requestTypes default',
    inputs: [
      { label: 'Built-in rules', origin: 'builtin', json: { providers: { trackers: { domainPatterns: ['||tracker.example^'], completeProvider: true } } } },
      { label: 'Remote file', origin: 'remote', json: { defaults: { requestTypes: ['main_frame'] }, providers: { trackers: { domainPatterns: ['||tracker.example^'], completeProvider: true } } } }
    ],
    mergedLabel: 'The remote provider after loading',
    merged: { trackers: { domainPatterns: ['||tracker.example^'], completeProvider: true, resourceTypes: ['main_frame'] } },
    runs: [
      { pattern: '||tracker.example^', origin: 'builtin', note: 'blocks every request', rows: [] },
      { pattern: '||tracker.example^', origin: 'remote', note: 'blocks page loads, once you accept block', rows: [] }
    ],
    explain: 'The default becomes the remote provider\'s resourceTypes as it loads, and resourceTypes is part of what makes providers match. So these two stay separate providers.'
  }
];

// Which sources load, one card per row of the decision table.
export const sourceCases = [
  { settings: { 'Built-in': 'Off', Remote: 'Off' }, layers: [], result: 'No base rules: custom rules only' },
  { settings: { 'Built-in': 'On', Remote: 'Off' }, layers: ['builtin'], result: 'Built-in' },
  { settings: { Remote: 'On', 'Remote files': 'Verified', 'Overload strategy': 'Off' }, layers: ['remote'], result: 'Remote replaces built-in' },
  { settings: { 'Built-in': 'On', Remote: 'On', 'Remote files': 'Verified', 'Overload strategy': 'Patch mode + merge' }, layers: ['remote', 'builtin'], merged: true, result: 'Built-in and remote merge; patches apply' },
  { settings: { 'Built-in': 'On', Remote: 'On', 'Remote files': 'Verified', 'Overload strategy': 'No patch mode + merge' }, layers: ['remote', 'builtin'], merged: true, result: 'Built-in and remote merge; patches are skipped' },
  { settings: { 'Built-in': 'Off', Remote: 'On', 'Remote files': 'Verified', 'Overload strategy': 'Patch mode + merge' }, layers: ['remote'], merged: true, result: 'Remote providers merge; patches apply' },
  { settings: { 'Built-in': 'Off', Remote: 'On', 'Remote files': 'Verified', 'Overload strategy': 'Patch mode only' }, layers: [], result: 'Remote providers are omitted; there are no built-in rules to patch' },
  { settings: { 'Built-in': 'On', Remote: 'On', 'Remote files': 'All failed', Cache: 'Available', 'Overload strategy': 'Patch mode only' }, layers: ['builtin'], result: 'Built-in rules load with cached remote patches' },
  { settings: { 'Built-in': 'On', Remote: 'On', 'Remote files': 'All failed', Cache: 'Available', 'Overload strategy': 'No patch mode + merge' }, layers: ['cache', 'builtin'], merged: true, result: 'Cached remote and built-in merge; patches are skipped' },
  { settings: { Remote: 'On', 'Remote files': 'All failed', Cache: 'Available', 'Overload strategy': 'Off' }, layers: ['cache'], result: 'Cached remote' },
  { settings: { 'Built-in': 'On', Remote: 'On', 'Remote files': 'All failed', Cache: 'None' }, layers: ['builtin'], result: 'Built-in' },
  { settings: { 'Built-in': 'Off', Remote: 'On', 'Remote files': 'All failed', Cache: 'None' }, layers: [], result: 'No base rules: custom rules only' }
];

// What starts each case: a setting or action of yours ('you'), or what Linkumori then does
// on its own every time rules load ('auto'). Shown as the first line of each case card.
const OVERLOAD_ON = ['you', 'You chose Patch mode + merge with order stripping off, with built-in rules on and a remote rule file set up.'];
const MERGE_ON_LOAD = ['auto', 'Every load merges the files. The same text is resolved when rules run.'];
const CUSTOM_SAVED = ['you', 'You saved a custom provider in the custom rules editor.'];
const DEFAULTS_ON_LOAD = ['auto', 'Every load writes each file\'s own defaults into its rules, then merges them.'];

export const caseTriggers = {
  'ov-own-order': [OVERLOAD_ON, MERGE_ON_LOAD],
  'ov-inherit': [OVERLOAD_ON, MERGE_ON_LOAD],
  'ov-null': [OVERLOAD_ON, MERGE_ON_LOAD],
  'ov-two-files': [OVERLOAD_ON, ['you', 'You listed file 1 before file 2 in settings.'], MERGE_ON_LOAD],
  'ov-two-files-inherit': [OVERLOAD_ON, ['you', 'You listed file 1 before file 2 in settings.'], MERGE_ON_LOAD],
  'ov-swap': [OVERLOAD_ON, MERGE_ON_LOAD],
  'ov-same-order': [OVERLOAD_ON, MERGE_ON_LOAD],
  'ov-other-pattern': [OVERLOAD_ON, ['auto', 'Every load keeps the two apart, because their patterns differ.']],
  'ov-referral': [OVERLOAD_ON, ['you', 'Allow referral marketing is a switch in settings.'], MERGE_ON_LOAD],
  'cu-replace': [CUSTOM_SAVED, ['auto', 'Every load replaces the built-in provider with yours. Saving starts a load straight away.']],
  'cu-methods': [CUSTOM_SAVED, ['auto', 'Every load replaces the built-in provider, whatever the settings.']],
  'cu-two-base': [CUSTOM_SAVED, ['auto', 'Every load replaces both built-in providers on the pattern.']],
  'cu-pattern': [CUSTOM_SAVED, ['auto', 'Every load adds yours next to the built-in provider.']],
  'cu-order': [CUSTOM_SAVED, ['auto', 'Every load compares the patterns as a set and replaces.']],
  'cu-name': [CUSTOM_SAVED, ['auto', 'Every load adds yours and renames it amazon_1.']],
  'cu-off': [['you', 'You switched the provider off in the custom rules editor.'], ['auto', 'Every load removes it from the base and the custom rules.']],
  'cu-nopattern': [['you', 'You saved a custom provider without a pattern.'], ['auto', 'Every load drops it.']],
  'de-different': [OVERLOAD_ON, DEFAULTS_ON_LOAD],
  'de-remote-wins': [OVERLOAD_ON, DEFAULTS_ON_LOAD],
  'de-builtin-default': [OVERLOAD_ON, DEFAULTS_ON_LOAD],
  'de-exceptions': [OVERLOAD_ON, DEFAULTS_ON_LOAD],
  'de-active': [OVERLOAD_ON, DEFAULTS_ON_LOAD],
  'de-own-value': [['auto', 'Every load writes the file\'s defaults into its rules. Nothing for you to set.']],
  'de-yours': [
    ['you', 'In Manage rule defaults, you filled in your own block and chose Yours for built-in and remote rules.'],
    OVERLOAD_ON,
    ['auto', 'Every load writes your block into both files\' rules instead of their own, then merges them.']
  ],
  'de-edit': [
    ['you', 'In Manage rule defaults, you edited the remote file\'s defaults to an empty block.'],
    ['auto', 'Every load uses your edit in place of the file\'s own block.']
  ],
  'de-history': [OVERLOAD_ON, ['auto', 'Every load copies the provider\'s setting onto its rules, then merges them.']],
  'defaults-merge-tool': [
    ['you', 'You chose Merge from sources in Manage rule defaults and ticked these three sources.'],
    ['you', 'You copy the merged block into one of your sets and save. Until then nothing is stored.'],
    ['auto', 'From then on, every load writes the saved block into the sources it applies to.']
  ],
  'de-complete': [
    OVERLOAD_ON,
    ['you', 'You accepted block for the remote file in Remote Rules Health.'],
    ['auto', 'Every load writes the default into the remote provider as resourceTypes, so the two stay apart.']
  ]
};
