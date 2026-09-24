# Node.js Streams Guide

What streams are, why `req` and `res` are streams, and how to use them without shooting yourself in the foot.

---

## `node:http` vs `http`

**Functionally identical.** Same module, same object. The `node:` prefix is a newer convention.

```js
require('http')        // works
require('node:http')   // works, preferred
```

| Reason | Detail |
|---|---|
| **No ambiguity** | The prefix *always* means builtin, never an npm package |
| **Can't be shadowed** | Someone could publish a package named `http`; `node:http` can never resolve to it |
| **Faster resolution** | No filesystem lookup at all |
| **Required for newer modules** | `node:test` and `node:sqlite` have no bare form |

Use the prefix in new code. Nothing breaks without it.

---

## What is a stream?

**Data that arrives (or leaves) in pieces over time, instead of all at once.**

```js
const data = fs.readFileSync('movie.mp4');   // 2GB → entirely in RAM, then you act
fs.createReadStream('movie.mp4');            // ~64KB chunks → act as each arrives
```

The second uses ~64KB of memory regardless of file size.

### Two reasons this matters

**Memory.** A 2GB file loaded whole needs 2GB of RAM. Ten concurrent users needs 20GB. Streamed, it's 640KB.

**Time.** You can't load a whole thing that doesn't exist yet. An HTTP request body is still travelling over the network when your handler starts running — there is nothing to "load."

**Mental model:** a conveyor belt, not a truck. Pieces come past one at a time, you handle each, they move on.

---

## The four types

| Type | Direction | Example |
|---|---|---|
| **Readable** | data comes **out** — you consume | `fs.createReadStream()`, `req`, `process.stdin` |
| **Writable** | data goes **in** — you produce | `fs.createWriteStream()`, `res`, `process.stdout` |
| **Duplex** | both, independently | `net.Socket` (TCP), WebSocket |
| **Transform** | Duplex where output is a function of input | `zlib.createGzip()`, `crypto.createCipheriv()` |

---

## Why `req` is Readable and `res` is Writable

Direction, from your server's perspective:

```
CLIENT  ──── request body ────►  YOUR SERVER     you READ it   → req is Readable
CLIENT  ◄─── response body ────  YOUR SERVER     you WRITE it  → res is Writable
```

`req` carries data toward you. `res` carries data away. That's the whole reason.

---

## Consequences you hit immediately

### There is no `req.body`

The body hasn't arrived when your handler starts. You assemble it:

```js
async function readBody(req, limit = 1e6) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {       // Readable is async-iterable
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

Express *looks* like it gives you `req.body` because `express.json()` middleware runs exactly this loop before your route handler.

**Always cap the size.** Without a limit, an endless body eats RAM until the process dies.

### `res.end()` is mandatory

A writable stream stays open until you close it. Forget `end()` and the client hangs — nothing has told it the response is finished.

Call it twice and you get `ERR_STREAM_WRITE_AFTER_END`, thrown inside a handler with nothing catching it, killing the process.

### You can connect them directly

```js
fs.createReadStream('video.mp4').pipe(res);
```

Nothing loads into memory. Chunks flow from disk to the network.

---

## Reading a Readable

Three ways, in order of preference:

```js
// 1. async iteration — cleanest
for await (const chunk of stream) {
  // chunk is a Buffer unless an encoding is set
}

// 2. pipe into something
stream.pipe(destination);

// 3. events — the low-level form
stream.on('data',  chunk => { });
stream.on('end',   ()    => { });   // no more data
stream.on('error', err   => { });   // ALWAYS handle this
```

Attaching a `'data'` listener or calling `pipe()` switches the stream into **flowing mode** — data starts arriving immediately. Before that it's paused.

### Line-by-line

```js
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('huge.log'),
  crlfDelay: Infinity,     // treat \r\n as one line break
});

for await (const line of rl) {
  // constant memory regardless of file size
}
```

---

## Writing to a Writable

```js
stream.write(chunk);       // returns false when the internal buffer is full
stream.end([chunk]);       // final write + close
stream.destroy();          // abort immediately

stream.on('drain',  () => { });   // buffer emptied, safe to write again
stream.on('finish', () => { });   // end() called and all data flushed
stream.on('error',  () => { });
```

---

## Backpressure

**The reason piping beats a manual loop.**

If your source is fast (local disk) and your destination is slow (a phone on 3G), chunks pile up in memory faster than they drain. That's an unbounded memory leak.

`write()` returning `false` is the signal: *"my buffer is full, stop."* You wait for `'drain'` before continuing.

```js
// ❌ ignores backpressure — memory grows unbounded
for await (const chunk of readable) {
  writable.write(chunk);
}

// ✅ pipeline handles it for you
await pipeline(readable, writable);
```

Getting this right by hand is fiddly. Use `pipeline`.

---

## `pipeline` over `.pipe()`

```js
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const zlib = require('node:zlib');

await pipeline(
  fs.createReadStream('in.txt'),
  zlib.createGzip(),
  fs.createWriteStream('out.txt.gz')
);
```

| | `.pipe()` | `pipeline()` |
|---|---|---|
| Backpressure | ✅ | ✅ |
| Error propagation | ❌ | ✅ |
| Cleans up on failure | ❌ **leaks the source** | ✅ destroys every stream |
| Promise-based | ❌ | ✅ |

**The leak is real.** If the destination errors — a client closing their browser tab mid-download — plain `.pipe()` leaves the source stream open forever. Do this enough times and you run out of file descriptors.

Use `pipeline` unless you have a specific reason not to.

---

## Transform streams

Data in, modified data out. Sits between a Readable and a Writable.

```js
const { Transform } = require('node:stream');

const upper = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  }
});

await pipeline(process.stdin, upper, process.stdout);
```

Built-in transforms you'll actually use: `zlib.createGzip()`, `zlib.createGunzip()`, `crypto.createHash()`, `crypto.createCipheriv()`.

---

## Object mode

By default streams carry **Buffers or strings**. Object mode lets them carry arbitrary JS values.

```js
const { Readable } = require('node:stream');

const users = Readable.from([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
]);   // object mode automatically
```

Useful for database cursors and CSV row processing — stream records one at a time instead of loading a million rows into an array.

Note `highWaterMark` means **16 objects** in object mode, not 16KB.

---

## Practical patterns

### Serve a file

```js
const { pipeline } = require('node:stream/promises');

http.createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    await pipeline(fs.createReadStream('video.mp4'), res);
  } catch (err) {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
```

### Compress on the fly

```js
res.writeHead(200, { 'Content-Encoding': 'gzip' });
await pipeline(fs.createReadStream('big.json'), zlib.createGzip(), res);
```

### Copy a file with progress

```js
let bytes = 0;
const src = fs.createReadStream('a.bin');
src.on('data', c => { bytes += c.length; });
await pipeline(src, fs.createWriteStream('b.bin'));
```

### Collect a stream into memory (when it's genuinely small)

```js
const { buffer } = require('node:stream/consumers');
const buf = await buffer(stream);

// also available: text(), json(), arrayBuffer()
const { json } = require('node:stream/consumers');
const data = await json(req);
```

---

## Gotchas

- **Chunks are Buffers**, not strings, unless you set an encoding. `chunk.toString()` on a multi-byte character split across a chunk boundary produces mojibake — use `setEncoding('utf8')` or `StringDecoder`.
- **A chunk is not a line, a record, or a message.** Boundaries fall wherever the OS decided. Never assume alignment.
- **`'error'` must be handled** on every stream. An unhandled `'error'` event throws and crashes the process.
- **`.pipe()` does not forward errors.** This is the single most common streams bug.
- **`end` vs `finish`** — `'end'` is Readable (no more data to read), `'finish'` is Writable (everything written and flushed).
- **A stream can only be consumed once.** Read it and it's gone.
- **`highWaterMark`** defaults to 64KB for file streams, 16KB for most others. It's a buffering hint, not a hard limit.
- **`res` is also a stream**, so calling `res.end()` twice is a stream error, not an HTTP one.

---

## Reference

- Streams API — <https://nodejs.org/api/stream.html>
- Promises API (`pipeline`) — <https://nodejs.org/api/stream.html#streams-promises-api>
- Consumers (`text`, `json`, `buffer`) — <https://nodejs.org/api/webstreams.html#utility-consumers>
- Backpressure guide — <https://nodejs.org/en/learn/modules/backpressuring-in-streams>
