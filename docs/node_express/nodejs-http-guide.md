# Node.js `http` and `createServer` Guide

Everything about building an HTTP server with the built-in module.

---

## The one idea that explains everything

**`req` is a readable stream. `res` is a writable stream.**

Almost every confusing thing about Node's `http` module makes sense once you hold onto that. There is no `req.body` — Express gives you one because middleware assembled it. Raw Node makes you read the stream yourself.

```js
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(3000, () => console.log('listening on 3000'));
```

---

## `createServer`

```js
http.createServer([options], [requestListener])
```

The listener runs **once per request**. It's just `server.on('request', fn)` — you can attach more listeners later if you want.

### Useful options

| Option | Purpose |
|---|---|
| `keepAlive` | Enable keep-alive (default `true` in Node 16+) |
| `keepAliveTimeout` | Idle time before closing a connection (default 5s) |
| `headersTimeout` | Max time to receive full headers (default 60s) |
| `requestTimeout` | Max time for the whole request (default 300s) |
| `maxHeaderSize` | Header size cap (default 16KB) |
| `IncomingMessage` / `ServerResponse` | Custom subclasses |

---

## The `request` object

| Property | Value |
|---|---|
| `req.method` | `'GET'`, `'POST'`, … |
| `req.url` | **path only** — `/about?x=1`, no origin |
| `req.headers` | object, **keys lowercased** |
| `req.httpVersion` | `'1.1'` |
| `req.socket.remoteAddress` | client IP (or your proxy's) |

### `req.url` is not a URL

The constructor needs a base:

```js
const u = new URL(req.url, 'http://localhost');
u.pathname;                    // '/about'
u.searchParams.get('x');       // '1'
```

Use a dummy base when you only need path and query. `req.headers.host` is attacker-controlled — only use it if you've validated it or you're behind a trusted proxy that overwrites it.

### Reading the body

The body arrives as stream events, *after* your handler starts:

```js
async function readBody(req, limit = 1e6) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {      // req is async iterable
    size += chunk.length;
    if (size > limit) {
      req.destroy();
      throw new Error('Payload too large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

**Always cap the size.** Without a limit, a client sending an endless body eats your RAM until the process dies.

The callback form, for reference:

```js
let body = '';
req.on('data', chunk => { body += chunk; });
req.on('end', () => { /* body complete */ });
req.on('error', err => { /* aborted mid-transfer */ });
```

---

## The `response` object

```js
res.writeHead(200, { 'Content-Type': 'application/json' });
res.write('partial');
res.end('final');
```

| Method | Purpose |
|---|---|
| `res.writeHead(code, [message], [headers])` | Set status + headers, sends them |
| `res.setHeader(name, value)` | Set one header (before any body) |
| `res.getHeader(name)` | Read a header you've set |
| `res.removeHeader(name)` | Unset one |
| `res.statusCode = 404` | Alternative to `writeHead` |
| `res.write(chunk)` | Send body data, keeps connection open |
| `res.end([chunk])` | Finish the response |
| `res.headersSent` | Boolean — have headers gone out? |

### The ordering rule

**Headers go out first and cannot be recalled.** Once a single byte of body is written, `setHeader()` throws `ERR_HTTP_HEADERS_SENT`.

`res.end()` is **mandatory** — forget it and the client hangs until timeout. Call it **twice** and you get `ERR_STREAM_WRITE_AFTER_END`, which is thrown inside a handler with nothing catching it, killing the process.

### The helper that prevents both

```js
const send = (res, code, payload) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

// then always: return send(res, 404, { error: 'not found' });
```

Returning it from every branch makes "exactly one response per request" structurally hard to get wrong.

### `writeHead`'s second argument is a status *message*

```js
res.writeHead(404, 'not found');   // relabels the status LINE, not the body
res.writeHead(404, { 'Content-Type': 'application/json' });   // headers
```

Passing a string there is almost always a mistake.

---

## Routing by hand

```js
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }

  const u = new URL(req.url, 'http://localhost');

  switch (u.pathname) {
    case '/': {
      if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed');
      return send(res, 200, 'HomePage');
    }
    case '/about': {
      const name = u.searchParams.get('name') ?? 'stranger';
      return send(res, 200, `Hi ${name}`);
    }
    case '/signup': {
      if (req.method === 'GET')  return send(res, 200, 'signup form');
      if (req.method === 'POST') return send(res, 201, 'Success!');
      return send(res, 405, 'Method Not Allowed');
    }
    default:
      return send(res, 404, 'Not Found');
  }
});
```

### Two traps in this shape

**Braces on `switch` cases.** All cases share **one block scope**. Without `{ }`, `const` declared in two cases collides with a `SyntaxError`. Brace every case body.

**Braces on `if`/`else`.** An unbraced `else` takes **only the next statement** — indentation means nothing:

```js
else
  res.writeHead(404);
  res.end('...');     // NOT part of the else — runs on EVERY request
```

That's the double-`end()` crash. Always brace.

### Path parameters

```js
const segments = u.pathname.split('/').filter(Boolean);
// '/users/42/orders' → ['users', '42', 'orders']
const [resource, id, sub] = segments;
```

Everything is a **string**, and segments are **percent-encoded** — call `decodeURIComponent` on them.

**Path vs query:** path segments *identify a resource*, query strings *modify the request*. `/users/42/orders?status=open&page=2`. Required and hierarchical → path. Optional and combinatorial → query.

`URLPattern` (global in Node 24+) does named matching:

```js
const pattern = new URLPattern({ pathname: '/users/:id/orders/:orderId' });
const match = pattern.exec(req.url, 'http://localhost');
if (match) {
  const { id, orderId } = match.pathname.groups;
}
```

---

## Streaming responses

`res` is writable, so pipe into it:

```js
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');

await pipeline(fs.createReadStream('big.mp4'), res);
```

Use `pipeline`, not `.pipe()` — plain `.pipe()` leaks the source stream if the destination dies, and a client closing their tab is exactly that case.

Streaming avoids loading the whole file into memory, and starts sending bytes immediately.

---

## Logging requests

```js
const logStream = fs.createWriteStream('./req.log', { flags: 'a' });

logStream.write(JSON.stringify({
  time: new Date().toISOString(),
  method: req.method,
  url: req.url,
  headers: req.headers,
  remoteAddress: req.socket.remoteAddress,
}) + '\n');
```

### Three mistakes to avoid

**`JSON.stringify(req)` throws.** `TypeError: Converting circular structure to JSON` — `req.socket._httpMessage` points back at `req`. Even with a replacer that strips cycles, you'd get mostly internal state, no methods, `{}` for native handles, and **no body** (it hasn't arrived yet). Pick fields explicitly.

**Don't gate the response on the log write.** Putting your routing inside an `appendFile` callback makes every response wait on disk I/O it doesn't need. Log and respond independently.

**`appendFile` per request is open+write+close every time.** One long-lived `createWriteStream` is far cheaper.

Redact `authorization`, `cookie`, and `x-api-key` before writing headers to disk.

---

## Status codes

| Code | When |
|---|---|
| 200 | OK |
| 201 | Created (after POST) |
| 204 | No Content (empty body — e.g. favicon) |
| 301 / 302 | Moved permanently / found |
| 304 | Not Modified (caching) |
| 400 | Bad Request (malformed input) |
| 401 / 403 | Unauthenticated / unauthorized |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 413 | Payload Too Large |
| 429 | Too Many Requests |
| 500 | Server error |

**A body string saying "404 Not Found" does not set the status.** `res.end('404 Not Found')` sends a **200** with that text. Set the code explicitly.

---

## Client side

```js
// modern — global since Node 18
const r = await fetch('https://api.example.com/x');
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const data = await r.json();
```

**`fetch` does not reject on 4xx/5xx.** Only network failures reject. Check `r.ok` yourself.

Node's `fetch` is implemented by **undici**. For connection pooling, retries, or proxy config, install `undici` and use its `Agent`/`Pool`.

`http.request()` still exists for low-level control (streaming request bodies, custom agents), and is callback + stream based.

---

## `http` vs `https` vs `http2`

`https.createServer({ key, cert }, handler)` — otherwise identical.

In practice you rarely terminate TLS in Node. nginx, Caddy, or a cloud load balancer does it and forwards plain HTTP. That's why `req.socket.remoteAddress` gives you the **proxy's** IP — the real client is in `X-Forwarded-For`, which you must only trust when you control the proxy.

`node:http2` is a separate module with a different API. Browsers require TLS for HTTP/2.

---

## Server lifecycle

```js
server.listen(3000, '0.0.0.0', () => { });
server.close(() => { });               // stop accepting, wait for in-flight
server.closeAllConnections();          // force-close idle keep-alives (Node 18.2+)
server.closeIdleConnections();
```

### Graceful shutdown

```js
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 10_000).unref();   // hard deadline
});
```

`server.close()` alone appears to hang because keep-alive connections stay open. `closeIdleConnections()` is what unblocks it.

---

## Error handling

There is **no per-request isolation**. An uncaught throw in a handler kills the whole process, and an async handler that rejects with no `.catch()` is an unhandled rejection — also fatal in modern Node.

```js
const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.on('clientError', (err, socket) => {
  if (!socket.writableEnded) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
```

The `headersSent` check matters — if the error happened mid-stream, headers are already gone and `writeHead` would throw a second error inside your error handler.

---

## Gotchas

- **`req.url` is a path**, never a full URL. Always pass a base to `new URL`.
- **`res.end()` is mandatory.** Missing it hangs the client.
- **Calling `res.end()` twice** throws `ERR_STREAM_WRITE_AFTER_END` and crashes.
- **Unbraced `if`/`else`** silently runs the following line unconditionally.
- **`switch` cases share one scope** — brace them before declaring `const`.
- **`JSON.stringify(req)`** throws on circular structure.
- **Headers are lowercased** in `req.headers`.
- **Body size must be capped** or you have a memory DoS.
- **`fetch` doesn't reject on 4xx/5xx** — check `.ok`.
- **`EADDRINUSE`** usually means a zombie process from a crashed run still holds the port.
- **Response body ≠ status code.** Set both.
- **`writeHead`'s 2nd string argument** is the status message, not headers.

---

## Debugging in VS Code

Fastest path: `Ctrl+Shift+P` → **"Debug: JavaScript Debug Terminal"**, then run `node index.js` in it. Breakpoints attach automatically, no config file.

Or `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [{
    "type": "node",
    "request": "launch",
    "name": "Debug server",
    "program": "${workspaceFolder}/index.js",
    "skipFiles": ["<node_internals>/**"],
    "console": "integratedTerminal",
    "runtimeArgs": ["--watch"]
  }]
}
```

- **Conditional breakpoints** — right-click a breakpoint, add `req.method === 'POST'`. Essential on a server where a plain breakpoint fires on every request.
- **Logpoints** — right-click the gutter; prints without stopping and without editing code.
- **Caught Exceptions** — tick it in the Breakpoints panel. Pauses at the exact line that threw, with full scope live. This is what finds double-`end()` and circular-JSON errors instantly.
- **Debug Console** — evaluate `req.headers` in scope instead of `console.log`.

---

## Reference

- `http` — <https://nodejs.org/api/http.html>
- `createServer` — <https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener>
- `IncomingMessage` — <https://nodejs.org/api/http.html#class-httpincomingmessage>
- `ServerResponse` — <https://nodejs.org/api/http.html#class-httpserverresponse>
- `https` — <https://nodejs.org/api/https.html>
- `http2` — <https://nodejs.org/api/http2.html>
- undici — <https://undici.nodejs.org/>
