# Node.js `fs` and `fs/promises` Guide

The most commonly used file system operations, and the decisions around them.

---

## Three APIs, one module

```js
const fs  = require('node:fs');            // callback-based
const fsp = require('node:fs/promises');   // promise-based
// fs.readFileSync                         // sync, lives on the same fs object
```

```js
fs.readFile('a.txt', 'utf8', (err, data) => { });   // error-first callback
const data = fs.readFileSync('a.txt', 'utf8');      // throws on error
const data = await fsp.readFile('a.txt', 'utf8');   // rejects on error
```

**Use `fs/promises` in new code.** It's a first-class module, not a `promisify` wrapper, and it gives you `FileHandle` objects instead of raw integer file descriptors.

Use the `node:` prefix on imports. It's explicit, marginally faster to resolve, and can't be shadowed by an npm package of the same name.

---

## Sync vs async — what's actually happening

Node runs your JS on **one thread**. A sync call doesn't block one function; it **freezes the entire process** — no other request served, no timer fired, no callback run.

| Use sync | Never use sync |
|---|---|
| CLI tools, build scripts | Inside a request handler |
| Loading config before `server.listen()` | Any hot path |
| Migration scripts | Anything serving users |

### Async isn't free either

Unlike network I/O (which uses `epoll`/`kqueue` at the kernel level), **file I/O goes through libuv's threadpool — 4 threads by default.** Saturate it and async calls queue behind each other.

```bash
UV_THREADPOOL_SIZE=8 node index.js    # raise it
UV_THREADPOOL_SIZE=1 node index.js    # make ordering deterministic for debugging
```

Async means *the work is delegated and your thread is freed* — not "parallel" and not "free."

### The category with no async version

CPU work in JavaScript. `await` yields on I/O, not on computation. A tight loop, a huge `JSON.parse`, a heavy regex — none of these have an async form. That needs `worker_threads`.

---

## Reading

```js
// whole file as string
const text = await fsp.readFile('./a.txt', 'utf8');

// whole file as Buffer (omit encoding)
const buf = await fsp.readFile('./img.png');

// directory listing
const names = await fsp.readdir('./src');                         // ['a.js', 'b.js']
const entries = await fsp.readdir('./src', { withFileTypes: true }); // Dirent objects
const all = await fsp.readdir('./src', { recursive: true });       // Node 20+
```

**`withFileTypes: true` is worth defaulting to** — each `Dirent` has `.name`, `.isFile()`, `.isDirectory()`, `.isSymbolicLink()`, which saves you a `stat()` syscall per entry.

### `opendir` for huge directories

`readdir` buffers the entire listing into an array first. For tens of thousands of entries, stream it:

```js
const dir = await fsp.opendir('./huge');
for await (const dirent of dir) {
  console.log(dirent.name);
}
```

---

## Writing

```js
await fsp.writeFile('a.txt', 'content');           // creates or OVERWRITES
await fsp.appendFile('log.txt', 'line\n');         // creates or appends
await fsp.writeFile('a.txt', 'x', { flag: 'wx' }); // fail if it already exists
```

### Flags worth knowing

| Flag | Meaning |
|---|---|
| `'w'` | write, truncate, create if missing (**default**) |
| `'a'` | append, create if missing |
| `'wx'` | write, but **fail** if the file exists |
| `'ax'` | append, but fail if it exists |
| `'r'` | read only, fail if missing |
| `'r+'` | read/write, fail if missing |

### Repeated writes → use a stream

`appendFile` is open + write + close on **every call**. For a log written per request, open one handle for the process:

```js
const logStream = fs.createWriteStream('./app.log', { flags: 'a' });
logStream.write(line);   // no syscall storm
```

---

## Directories and deletion

```js
await fsp.mkdir('a/b/c', { recursive: true });   // creates parents, no EEXIST
await fsp.rm('dir', { recursive: true, force: true });  // modern rmdir replacement
await fsp.unlink('file.txt');                    // delete a single file
await fsp.rename('old.txt', 'new.txt');          // also used to move
await fsp.copyFile('a.txt', 'b.txt');
await fsp.cp('src', 'dest', { recursive: true }); // Node 16.7+
```

**`{ recursive: true }` on `mkdir` makes it idempotent** — no throw if the directory exists, and missing parents get created. Without it you'd catch `EEXIST` at every level.

`rmdir` with `recursive` is deprecated. Use `rm`.

---

## Stats and existence

```js
const st = await fsp.stat('./a.txt');
st.isFile();        // true
st.isDirectory();
st.size;            // bytes
st.mtime;           // last modified (Date)
st.birthtime;       // created
```

`lstat` is the same but does **not** follow symlinks — it describes the link itself.

### Don't check-then-act

```js
// BAD — TOCTOU race, the file can vanish between the two lines
if (fs.existsSync(p)) fs.readFileSync(p);

// GOOD — just try it
try {
  await fsp.readFile(p);
} catch (e) {
  if (e.code === 'ENOENT') { /* handle missing */ }
  else throw e;
}
```

`fs.exists` (callback form) is deprecated for exactly this reason. `existsSync` still exists and is fine for one-off startup checks, but never as a guard before an operation.

If you genuinely just need a boolean:

```js
const exists = await fsp.access(p).then(() => true, () => false);
```

---

## Error codes

Branch on `err.code`, never on the message. These come straight from the OS.

| Code | Meaning |
|---|---|
| `ENOENT` | No such file or directory |
| `EEXIST` | Already exists |
| `EACCES` / `EPERM` | Permission denied |
| `EISDIR` | Expected a file, got a directory |
| `ENOTDIR` | Expected a directory, got a file |
| `ENOTEMPTY` | Directory not empty |
| `EMFILE` | Too many open file descriptors |
| `ENOSPC` | No space left on device |

### The error-first convention is binary

```js
// BAD — an empty file is falsy, falls into the wrong branch
fs.readFile(p, 'utf8', (err, res) => {
  if (err) ...
  else if (res) ...        // res === '' for an empty file!
  else console.log('unexpected');
});

// GOOD
fs.readFile(p, 'utf8', (err, res) => {
  if (err) return console.error(err);
  console.log(res);
});
```

If `err` is null, the operation succeeded. Period.

---

## `FileHandle` — the promise API's real advantage

`fsp.open()` resolves to an object with methods, not an integer fd:

```js
const fh = await fsp.open('log.txt', 'a');
try {
  await fh.write('line\n');
  const { size } = await fh.stat();
  const buf = await fh.readFile();
} finally {
  await fh.close();   // you own this — leaked handles cause EMFILE
}
```

Node 22+ with TypeScript 5.2+ supports automatic cleanup:

```js
await using fh = await fsp.open('log.txt', 'a');
// closed automatically at scope exit
```

`FileHandle` also has `.createReadStream()` and `.createWriteStream()`.

---

## Streams — for anything large

`readFile` loads the **whole file into memory**. For large files, stream it.

```js
const fs = require('node:fs');
fs.createReadStream('big.mp4').pipe(res);
```

Note `createReadStream` / `createWriteStream` live on plain `fs`, not `fs/promises`.

### Use `pipeline`, not `.pipe()`

Plain `.pipe()` leaks the source stream if the destination errors — a client closing their browser tab is exactly that case.

```js
const { pipeline } = require('node:stream/promises');

await pipeline(
  fs.createReadStream('in.txt'),
  zlib.createGzip(),
  fs.createWriteStream('out.txt.gz')
);
```

`pipeline` propagates errors and destroys every stream in the chain on failure.

### Line-by-line reading

```js
const rl = require('node:readline').createInterface({
  input: fs.createReadStream('huge.log'),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  // process one line, constant memory
}
```

---

## Watching

```js
// promise API — async iterator
for await (const event of fsp.watch('./src', { recursive: true })) {
  console.log(event.eventType, event.filename);
}

// callback API — EventEmitter
fs.watch('./src', (eventType, filename) => { });
```

`fs.watch` is OS-backed and efficient but **inconsistent across platforms** — duplicate events, missing `filename` on some systems, no recursive support on Linux before Node 20. For anything production-critical, use `chokidar`.

---

## Recursive directory work

### Creating a tree from a structure

```js
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

async function materialize(node, parentDir) {
  const target = path.join(parentDir, safeName(node.name));

  if (node.type === 'file') {
    await fsp.writeFile(target, '');
    return;
  }

  await fsp.mkdir(target, { recursive: true });
  for (const child of node.children) {
    await materialize(child, target);   // sequential — see concurrency note
  }
}

function safeName(name) {
  const clean = path.basename(name);   // strips any separators
  if (!clean || clean === '.' || clean === '..') {
    throw new Error(`Invalid name: ${name}`);
  }
  return clean;
}
```

**Ordering matters:** the parent `mkdir` must be awaited *before* children are created.

**Guard the names.** A `name` of `"../../etc/passwd"` walks straight out of your output directory — `path.join` resolves it happily. Always `path.basename()` untrusted names.

**Concurrency:** `Promise.all(children.map(...))` launches every leaf at once. With a 4-thread pool and one file descriptor per open file, a few thousand concurrent writes gives you `EMFILE`. Go sequential, or cap it with `p-limit`.

### Reading a tree into a structure

```js
async function readTree(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return {
    name: path.basename(dir),
    type: 'folder',
    children: await Promise.all(entries.map(e =>
      e.isDirectory()
        ? readTree(path.join(dir, e.name))
        : { name: e.name, type: 'file' }
    )),
  };
}
```

---

## Race conditions

Queueing two operations doesn't order them.

```js
// BROKEN — nothing sequences these
fs.writeFile('a.txt', 'data', cb);
fs.readFile('a.txt', 'utf8', cb);   // may run first → ENOENT or empty read
```

Both go to the threadpool with no dependency between them. It may "work" because something else on the main thread delays the read — that's luck, not correctness.

```js
// CORRECT — the await expresses the dependency
await fsp.writeFile('a.txt', 'data');
const text = await fsp.readFile('a.txt', 'utf8');
```

The only ordering you can depend on is the one you write explicitly.

### Debugging tip

```bash
UV_THREADPOOL_SIZE=1 node index.js
```

One pool thread means work executes in submission order, making interleavings deterministic and reasonable to trace.

---

## Always use `path`

Never concatenate filesystem paths with `+`.

```js
const path = require('node:path');

path.join('a', 'b', 'c.txt');       // 'a/b/c.txt' — handles separators
path.resolve('a', 'b');             // absolute, from cwd
path.basename('/a/b/c.txt');        // 'c.txt'
path.basename('/a/b/c.txt', '.txt') // 'c'
path.extname('c.txt');              // '.txt'
path.dirname('/a/b/c.txt');         // '/a/b'
```

`path.join` normalizes `..` and `.` — which is why it's a security concern with untrusted input, and why `basename` is the guard.

---

## Gotchas

- **No encoding → Buffer.** `readFile(p)` returns a Buffer; `readFile(p, 'utf8')` returns a string.
- **`writeFile` overwrites.** Use `appendFile` or `{ flag: 'a' }` to add.
- **Empty string is falsy.** Never use the result's truthiness to test success.
- **`Promise.all` on many files → `EMFILE`.** Cap concurrency.
- **`FileHandle` must be closed.** Leaks exhaust file descriptors.
- **`readFile` on a large file eats RAM.** Stream it.
- **Unhandled promise rejection terminates the process** in modern Node.
- **`JSON.stringify` on a `req` object throws** — circular structure. Pick fields explicitly.
- **Relative paths resolve against `process.cwd()`**, not the script's location. In ESM use `import.meta.dirname` (Node 20.11+) or `fileURLToPath(import.meta.url)`.

---

## Reference

- `fs` — <https://nodejs.org/api/fs.html>
- Promises API — <https://nodejs.org/api/fs.html#promises-api>
- `FileHandle` — <https://nodejs.org/api/fs.html#class-filehandle>
- `path` — <https://nodejs.org/api/path.html>
- `stream/promises` — <https://nodejs.org/api/stream.html#streams-promises-api>
