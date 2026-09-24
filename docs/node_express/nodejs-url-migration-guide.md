# Node.js URL Migration Guide

Moving from the legacy `require('url')` API to the modern WHATWG `URL` / `URLSearchParams`.

---

## The situation

| Thing | Status |
|---|---|
| `URL`, `URLSearchParams` | **Globals.** No import needed. |
| `node:url` module | Alive, but only for file-URL helpers. |
| `url.parse()`, `url.format(obj)`, `url.resolve()` | **Legacy.** Stability 3. Don't use in new code. |
| `querystring` module | Legacy. Superseded by `URLSearchParams`. |

`url.parse()` carries deprecation code **DEP0169**, flagged as *insecure*. It parses leniently where the WHATWG parser is strict, so the two disagree on malformed input. That gap is a known source of SSRF and host-spoofing bugs — validation code and fetching code parsing the same string differently.

Nothing prints a warning. Nothing breaks. But don't write new code with it.

---

## Migration table

| Legacy | Modern |
|---|---|
| `url.parse(str)` | `new URL(str)` |
| `url.parse(str, true).query.foo` | `u.searchParams.get('foo')` |
| `url.parse(str).path` | `u.pathname + u.search` |
| `url.format(urlObject)` | `u.toString()` or `u.href` |
| `url.resolve(base, rel)` | `new URL(rel, base).href` |
| `querystring.parse(str)` | `new URLSearchParams(str)` |
| `querystring.stringify(obj)` | `new URLSearchParams(obj).toString()` |
| `querystring.escape(str)` | `encodeURIComponent(str)` |
| `querystring.unescape(str)` | `decodeURIComponent(str)` |

---

## Parsing

```js
const u = new URL('https://user:pw@example.com:8080/a/b?x=1&y=2#top');
```

| Property | Value | Note |
|---|---|---|
| `u.protocol` | `'https:'` | **includes the colon** |
| `u.hostname` | `'example.com'` | no port |
| `u.host` | `'example.com:8080'` | with port |
| `u.port` | `'8080'` | **a string**; `''` when default |
| `u.pathname` | `'/a/b'` | percent-encoded, not decoded |
| `u.search` | `'?x=1&y=2'` | **includes the `?`** |
| `u.searchParams` | `URLSearchParams` | live object |
| `u.hash` | `'#top'` | **includes the `#`** |
| `u.origin` | `'https://example.com:8080'` | |
| `u.href` | full string | same as `toString()` |
| `u.username` / `u.password` | `'user'` / `'pw'` | |

### Gone from the legacy API

- **`query`** → use `search` (string) or `searchParams` (object)
- **`path`** → use `pathname + search`
- **`auth`** → use `username` and `password` separately

### It throws

```js
try {
  const u = new URL(input);
} catch {
  // invalid URL
}

// Node 18.17+ / modern browsers
if (!URL.canParse(input)) return;

// Node 22+ — returns null instead of throwing
const u = URL.parse(input);
```

---

## Query strings

```js
const p = u.searchParams;

p.get('x')            // '1'  — null if missing (NOT undefined)
p.getAll('tag')       // ['a','b'] for ?tag=a&tag=b
p.has('x')            // true
p.set('x', '9')       // replace (removes duplicates)
p.append('tag', 'c')  // add another
p.delete('x')
p.sort()              // canonical ordering — useful for cache keys
p.toString()          // 'y=2&tag=a&tag=b'
p.size                // number of entries (Node 19+)

for (const [k, v] of p) { }     // iterable
Object.fromEntries(p)           // plain object — DROPS duplicate keys
```

### Building

```js
new URLSearchParams({ q: 'node streams', page: 2 }).toString();
// 'q=node+streams&page=2'
```

Encoding is automatic. Spaces become `+` in query strings (form encoding), while `encodeURIComponent` produces `%20`. Both decode correctly.

### Mutation is live

Changing `searchParams` updates the parent URL immediately:

```js
u.searchParams.set('page', '3');
u.href;   // already reflects the change
```

---

## Building and resolving

```js
// relative resolution — the base's last segment is replaced
new URL('c', 'https://ex.com/a/b').href       // https://ex.com/a/c
new URL('/c', 'https://ex.com/a/b').href      // https://ex.com/c
new URL('../c', 'https://ex.com/a/b/').href   // https://ex.com/a/c

// assemble piece by piece
const u = new URL('https://api.example.com');
u.pathname = '/v1/users';
u.searchParams.set('limit', '10');
u.toString();   // https://api.example.com/v1/users?limit=10
```

The base must be absolute — `new URL('/a')` alone throws.

Trailing slashes change relative resolution: `/a/b` and `/a/b/` resolve `../c` differently.

---

## HTTP servers

`req.url` is a **path**, not a URL (`/about?name=x`), so the constructor needs a base:

```js
const u = new URL(req.url, 'http://localhost');
u.pathname;                     // '/about'
u.searchParams.get('name');     // 'deepanshu'
```

### Which base to use

Use a **dummy base** like `'http://localhost'` when you only need pathname and query.

Using `req.headers.host` puts attacker-controlled input into your URL. That's fine behind a trusted proxy that overwrites the header — dangerous if the resulting URL feeds a redirect, a generated link, or an outbound request.

### Path parameters

There's no built-in segment parser:

```js
const segments = u.pathname.split('/').filter(Boolean);
// '/users/42/orders' → ['users', '42', 'orders']

const [resource, id, sub] = segments;
```

Everything is a **string**, and segments are **percent-encoded** — `pathname` is not decoded for you:

```js
const name = decodeURIComponent(segments[1]);
```

### URLPattern

Standards-based route matching. Global in Node 24+; flagged earlier. Check availability on your version.

```js
const pattern = new URLPattern({ pathname: '/users/:id/orders/:orderId' });
const match = pattern.exec(req.url, 'http://localhost');

if (match) {
  const { id, orderId } = match.pathname.groups;
}
```

Docs: <https://developer.mozilla.org/en-US/docs/Web/API/URLPattern>

---

## What `node:url` is still for

File-URL conversion. These have no global equivalent.

```js
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// no __dirname in ESM — this is the replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

pathToFileURL('/a/b c.txt').href;   // 'file:///a/b%20c.txt'
```

**Never** use `new URL(fileUrl).pathname` to get a filesystem path. It breaks on spaces (`%20` stays encoded) and on Windows drive letters (`/C:/...`). Always `fileURLToPath`.

Node 20.11+ gives you these directly, removing even that import:

```js
import.meta.dirname
import.meta.filename
```

Also in the module: `urlToHttpOptions(url)` — converts a `URL` into the options object `http.request()` expects.

---

## Gotchas

- `protocol`, `search`, `hash` **keep their punctuation**; `hostname` and `port` don't.
- `port` is `''` when it's the protocol default (443 for https, 80 for http).
- `searchParams.get()` returns **`null`** for missing keys, not `undefined`.
- `Object.fromEntries(searchParams)` **silently drops duplicates** — use `getAll()` when repeats matter.
- The `URL` constructor **throws**. Wrap it, or use `URL.canParse()` / `URL.parse()`.
- `pathname` is **not** percent-decoded — call `decodeURIComponent` on segments yourself.
- `req.url` is a path, never a full URL. Always pass a base.

---

## Before / after

```js
// ── legacy ──────────────────────────────────
const url = require('url');

const myUrl = url.parse(request.url, true);
const name  = myUrl.query.name;
const path  = myUrl.pathname;

// ── modern ──────────────────────────────────
const myUrl = new URL(request.url, 'http://localhost');
const name  = myUrl.searchParams.get('name') ?? 'stranger';
const path  = myUrl.pathname;
```

---

## Reference

- Node URL API — <https://nodejs.org/api/url.html>
- WHATWG URL section — <https://nodejs.org/api/url.html#the-whatwg-url-api>
- Legacy URL section — <https://nodejs.org/api/url.html#legacy-url-api>
- DEP0169 — <https://nodejs.org/api/deprecations.html#DEP0169>
- MDN `URL` — <https://developer.mozilla.org/en-US/docs/Web/API/URL>
- MDN `URLSearchParams` — <https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams>
