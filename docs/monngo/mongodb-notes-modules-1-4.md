# MongoDB Study Notes — Modules 1 to 4

> Backend track: MongoDB standalone first, then MongoDB with Node.js.

---

## The Full Roadmap

### Part A — Mongo as a database (mongosh only, no Node)

| # | Module | Status |
|---|--------|--------|
| 1 | SQL vs NoSQL, core concepts | ✅ covered |
| 2 | Setup + CRUD basics | ✅ covered |
| 3 | Query operators in depth | ✅ covered |
| 4 | Update operators, upserts, array updates | ✅ covered |
| 5 | Cursors: projection, sort, skip/limit, pagination | pending |
| 6 | Indexes and `explain()` | pending |
| 7 | Aggregation pipeline (likely 2 sessions) | pending |
| 8 | Data modeling: embed vs reference, schema patterns | pending |
| 9 | Transactions, replica sets, sharding (conceptual) | pending |

### Part B — Mongo with Node.js

| # | Module | Status |
|---|--------|--------|
| 10 | Native driver: connect, pooling, CRUD from Node | pending |
| 11 | Mongoose: schemas, models, validation | pending |
| 12 | Mongoose middleware, virtuals, statics, methods | pending |
| 13 | `populate()` and relationships | pending |
| 14 | Building a REST API with structure + error handling | pending |
| 15 | Aggregations, transactions, indexes in Mongoose | pending |
| 16 | Production concerns: security, env config, performance, pitfalls | pending |

---

# Module 1 — SQL vs NoSQL + Core Concepts

## What "relational" actually means

SQL databases store data in **tables** with a **fixed schema**. Every row has exactly the columns the table declares. If a user has three addresses, you can't put them in the user row — you make an `addresses` table with a `user_id` foreign key and JOIN at read time.

This is **normalization**: each fact lives in exactly one place. Update a city name once and every query sees it. The cost is that reading one logical entity might touch five tables.

## What a document database does instead

MongoDB stores **documents**, which look like JSON:

```js
{
  _id: ObjectId("665f1a2b3c4d5e6f7a8b9c0d"),
  name: "Aditya",
  email: "aditya@example.com",
  addresses: [
    { type: "home",   city: "Gurugram", pin: "122001" },
    { type: "office", city: "Delhi",    pin: "110001" }
  ],
  createdAt: ISODate("2026-01-14T10:00:00Z")
}
```

The whole user, addresses included, is one document. One read gets everything. No joins.

## The mental shift

> In SQL you model data by **what it is**.
> In MongoDB you model data by **how you'll read it**.

Relational design starts from the entities and normalizes. Mongo design starts from your queries and shapes documents so the common query is a single lookup. Designing Mongo schemas like SQL tables gives you the worst of both worlds.

## Terminology map

| SQL | MongoDB |
|---|---|
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |
| Primary key | `_id` |
| Foreign key + JOIN | Embedding, or reference + `$lookup` |
| Index | Index (same idea) |
| `SELECT ... WHERE` | `db.coll.find({...})` |
| `GROUP BY` / complex SELECT | Aggregation pipeline |
| Schema migration | Often nothing; schema is flexible |

## Myths worth killing early

- **"Mongo has no transactions."** False since v4.0. Multi-document ACID transactions exist. They're just not the default tool, because good document design usually makes them unnecessary.
- **"Mongo has no joins."** `$lookup` exists in the aggregation pipeline. Less efficient than a relational join, and can't do everything SQL joins can — but it's real.
- **"Mongo has no schema."** No *enforced* schema by default, but JSON Schema validation exists at the collection level, and Mongoose enforces schemas in your app. "Schemaless" really means *the schema lives in your code, not the database*.
- **"NoSQL is faster."** Not inherently. Faster for the access patterns you designed for; can be much slower for the ones you didn't.

## When to pick which

**Lean SQL** when the data is highly relational with many-to-many links everywhere, when you need complex ad-hoc queries across entities, when strict multi-row consistency matters (banking, ledgers, inventory), or when reporting/BI tooling is a requirement.

**Lean Mongo** when entities are self-contained and read as a unit (posts with comments, orders with line items, product catalogs), when the shape of data varies between records, when you're iterating fast and the schema is still moving, or when you need easy horizontal scaling.

Honest take: for most CRUD web apps either works fine.

---

## Embedding vs referencing — the actual tradeoff

The tradeoff only appears when the embedded data is **shared by many documents**. A user's own addresses aren't duplicated — there's only one copy. An instructor attached to many courses is a different story.

**Referenced (SQL-like):**

```js
// instructors
{ _id: ObjectId("a1"), name: "Priya Nair", email: "priya@school.com" }

// courses
{ _id: 10, title: "Node Basics", instructorId: ObjectId("a1") }
{ _id: 11, title: "Mongo Deep Dive", instructorId: ObjectId("a1") }
```

Email changes → one update. But rendering a course needs a second lookup.

**Embedded:**

```js
{ _id: 10, title: "Node Basics",     instructor: { name: "Priya Nair", email: "priya@school.com" } }
{ _id: 11, title: "Mongo Deep Dive", instructor: { name: "Priya Nair", email: "priya@school.com" } }
```

Rendering a course is one query. But the email now physically exists in N places:

```js
db.courses.updateMany(
  { "instructor.email": "priya@school.com" },
  { $set: { "instructor.email": "priya.nair@school.com" } }
)
```

With 500 courses that's a slow write touching 500 documents — and if it fails halfway, some courses disagree with the others. **The real cost isn't speed, it's inconsistency.**

### The rule

**Embedding makes reads fast and writes expensive. Referencing makes writes cheap and reads expensive.**

- **Embed** when the data is **owned** by the parent — no independent life, nobody else points at it. User's addresses, order's line items, post's tags.
- **Reference** when the data is **shared** and **mutable** — many documents need it and it changes. Instructors, categories, companies.

### The snapshot exception

Sometimes duplication is the entire point:

```js
{
  _id: 900,
  items: [{ product: "iPhone 15", price: 79900, qty: 1 }],
  total: 79900
}
```

You *want* the frozen copy. The price on the day of purchase is a historical fact. Reference the product and a future price drop would silently rewrite your old invoices.

> Ask: is this duplicated data a **cache** of something that should stay in sync, or a **snapshot** of a moment?
> Cache → reference it. Snapshot → embed it.

---

## Core concepts before writing a query

**Hierarchy:** Deployment → Database → Collection → Document → Field. There is no `CREATE TABLE`.

**BSON, not JSON.** Binary JSON — JSON plus real types that JSON lacks:

- `ObjectId` — 12-byte id
- `Date` — real date type, ms since epoch
- `Int32`, `Int64`, `Double`, `Decimal128` — JSON only has one number type
- `Binary`, `Regex`, `Timestamp`, `null`, arrays, nested objects

This matters: a date stored as a string won't sort or range-query correctly.

**`_id`** is mandatory and unique in every document. If you don't supply one, Mongo generates an `ObjectId`: 4-byte timestamp + 5 random bytes + 3-byte counter. Two consequences — they're roughly sortable by creation time, and the creation timestamp is extractable from the id.

**Documents cap at 16MB**, nesting up to 100 levels. This is the hard limit that kills "just embed everything forever." An unbounded array (every event ever for a user) must become its own collection.

**Flexible schema.** Two documents in one collection can have completely different fields. Adding a field needs no migration and no downtime — but old documents won't have it, and your code must handle that.

---

## The built-in databases

Every deployment ships with these. Don't put application data in them.

| DB | Purpose |
|---|---|
| `admin` | Authentication/authorization. Users and roles live here. Server-wide admin commands run here. A user with a role in `admin` can be granted cross-database permissions. |
| `config` | Sharding metadata — chunk locations, shard keys, balancer state. Essentially empty on a standalone. |
| `local` | Data specific to *this one server*, never replicated. Holds the **oplog** (`local.oplog.rs`), which secondaries tail to stay in sync and which change streams are built on. |
| `test` | Not special. Just the default scratch db `mongosh` connects to. Doesn't exist until written to. |

---

# Module 2 — mongosh + CRUD

`mongosh` is a full JavaScript REPL — variables, loops, functions all work. The Mongo-specific part is the `db` object.

## Navigating

```js
show dbs           // list databases
use school         // switch to 'school'
db                 // which db am I on?
show collections   // collections in the current db
db.students        // handle to the 'students' collection
```

### How `db` actually works

`db` is a variable pointing at **whichever database you're currently `use`-ing**. The database name never appears in a command:

```js
use school
db.students.insertOne({ ... })   // → school.students

use library
db.students.find()               // → library.students, a DIFFERENT collection
```

`school.students.insertOne(...)` is a `ReferenceError` — database names don't become JS variables.

Cross-database access exists but is rarely needed: `db.getSiblingDB("library").students.find()`.

### Lazy creation — precisely

```js
use school                    // nothing created
db.students                   // nothing created — just a handle
db.students.find()            // nothing created — reads never create
db.students.insertOne({a:1})  // NOW the db and collection exist
```

`db.<anything>` always returns a collection handle, existence unchecked. `db.collections` prints `school.collections` without error and without creating anything. Only `show collections` hits the server for the real list.

## C — Create

```js
db.students.insertOne({
  name: "Deepanshu",
  age: 24,
  city: "Gurugram",
  skills: ["node", "react"],
  enrolled: true,
  joinedAt: new Date()
})

db.students.insertMany([
  { name: "Priya", age: 22, city: "Delhi",    skills: ["python"],         enrolled: true  },
  { name: "Rahul", age: 27, city: "Mumbai",   skills: ["java", "spring"], enrolled: false },
  { name: "Sneha", age: 21, city: "Gurugram", skills: ["node", "mongo"],  enrolled: true  }
])
```

Fields need not match across documents.

`insertMany` is **ordered** by default — if document 3 of 5 fails, 1–2 are inserted and 4–5 are not. Pass `{ ordered: false }` to insert everything possible and report failures at the end.

## R — Read

```js
db.students.find()                             // everything
db.students.find({ city: "Gurugram" })         // filter = WHERE
db.students.findOne({ name: "Priya" })         // first match, returns a document not a cursor
db.students.countDocuments({ enrolled: true })
```

Multiple keys in a filter are ANDed:

```js
db.students.find({ city: "Gurugram", enrolled: true })
```

Arrays match on containment with no special syntax:

```js
db.students.find({ skills: "node" })    // array CONTAINS "node"
```

### Counting

```js
db.students.countDocuments({ enrolled: true })  // exact, takes a filter, scans
db.students.estimatedDocumentCount()            // instant, metadata-based, no filter, may be stale
```

## Projection

The **second argument** to `find()` chooses which fields come back — `SELECT name, age` versus `SELECT *`.

Given `{ _id, name, age, city, skills, enrolled }`:

```js
// Include-mode — list what you WANT, with 1
db.students.find({}, { name: 1, age: 1 })
// → { _id: ObjectId("..."), name: "Priya", age: 22 }

// _id sneaks in by default; kill it explicitly
db.students.find({}, { name: 1, age: 1, _id: 0 })
// → { name: "Priya", age: 22 }

// Exclude-mode — list what you DON'T want, with 0
db.students.find({}, { skills: 0 })
// → everything except skills
```

**Pick one mode.** `{ name: 1, skills: 0 }` is contradictory and errors. `_id: 0` is the sole exception allowed alongside `1`s.

Why it matters: a document with a 200-item array costs real bandwidth when all you needed was the name.

## Cursors — the mental model

`find()` does **not** run the query and hand back results. It returns a **cursor**: a pointer to a result set on the server, fetched in batches as consumed.

> Think: a `for` loop the server hasn't started running yet — not a finished array.

Why: a collection could hold ten million matches. Loading all of them to satisfy `find({})` would kill the process. The cursor pulls ~101 documents first, then batches up to 16MB.

`mongosh` hides this by auto-iterating 20 and printing `Type "it" for more`. That's shell friendliness, not the return value:

```js
db.students.find()            // shell prints documents
var c = db.students.find()
c                             // now you see a cursor object
c.toArray()                   // NOW a real array
```

In Node nothing auto-iterates:

```js
const students = await collection.find({ city: "Gurugram" }).toArray();  // small sets

for await (const s of collection.find({})) {   // large sets — stream it
  console.log(s.name);
}
```

`findOne()` returns a document directly — at most one, so no cursor needed.

Cursor methods (`.sort()`, `.limit()`, `.skip()`) chain onto `find()` and modify the query **before** execution, which is why `find().sort().limit(5)` asks the server for the top 5 rather than fetching everything and slicing.

## U — Update

```js
db.students.updateOne(
  { name: "Deepanshu" },   // filter: which document
  { $set: { age: 25 } }    // action: what to change
)

db.students.updateMany(
  { city: "Gurugram" },
  { $set: { region: "NCR" } }
)
```

**Dot notation** reaches into nested objects:

```js
db.students.updateOne({ name: "Sneha" }, { $set: { "address.city": "Noida" } })
```

Creates `address` if missing. Quotes are required whenever a key contains a dot.

**Upsert** — update if found, insert if not:

```js
db.students.updateOne(
  { name: "Arjun" },
  { $set: { age: 26, city: "Pune" } },
  { upsert: true }
)
```

## D — Delete

```js
db.students.deleteOne({ name: "Rahul" })
db.students.deleteMany({ enrolled: false })
db.students.deleteMany({})   // empties the collection, keeps indexes
db.students.drop()           // destroys the collection entirely
```

No confirmation, no undo. Always eyeball the filter.

## The one rule

> Every operation is `db.<collection>.<method>(<filter>, <action>, <options>)`.
> Filter = *which documents*. Action = *what to do*. Options = tuning.

Once that clicks, the rest is just learning more operators.

---

## Module 2 Exercises

```js
// 1. Insert Kabir, 23, Jaipur, skills ["go","docker"], not enrolled
db.students.insertOne({
  name: "Kabir", age: 23, city: "Jaipur",
  skills: ["go", "docker"], enrolled: false
})

// 2. Enrolled students from Gurugram
db.students.find({ city: "Gurugram", enrolled: true })

// 3. Everyone with "node" in skills, name only, no _id
db.students.find({ skills: "node" }, { _id: 0, name: 1 })

// 4. Add docker to Sneha's skills
db.students.updateOne({ name: "Sneha" }, { $push: { skills: "docker" } })

// 5. Increment everyone's age by 1
db.students.updateMany({}, { $inc: { age: 1 } })

// 6. Add status:"active" to every enrolled student
db.students.updateMany({ enrolled: true }, { $set: { status: "active" } })

// 7. Remove Kabir
db.students.deleteOne({ name: "Kabir" })

// 8. Count enrolled students
db.students.countDocuments({ enrolled: true })
```

---

## ⚠️ Common Mistakes — Modules 1 & 2

**Using `insert()` instead of `insertOne` / `insertMany`.**
`insert()` is the deprecated legacy method from before the API split. It still runs but will eventually disappear. Always use the explicit `One`/`Many` forms.

**Omitting `$set` in an update.**

```js
db.students.updateOne({ name: "Priya" }, { age: 23 })   // ❌ ERROR
```

Without an operator, older Mongo interpreted this as *replace the entire document*, wiping every other field. Modern versions reject it outright, which is a mercy. For a genuine full replace, use `replaceOne()`.

**Looping in JavaScript instead of using `updateMany`.**

```js
// ❌ N round trips — fetch every doc, then one updateOne per doc
db.students.find().forEach(s =>
  db.students.updateOne({ _id: s._id }, { $inc: { age: 1 } })
)

// ✅ one command, one trip, server-side
db.students.updateMany({}, { $inc: { age: 1 } })
```

For 10,000 students the first version is 10,000 network calls. **The instinct to loop is a JavaScript instinct — fight it.** Nearly every time you reach for `forEach` with a write inside, there's an `updateMany` or an aggregation that does it server-side.

**Forgetting `countDocuments()` accepts a filter.**
`countDocuments()` counts everything; `countDocuments({ enrolled: true })` counts what you asked for. Same filter syntax as `find()`.

**Typos fail silently.**
`db.studnets.find()` returns zero results, not an error — Mongo assumes you're asking about a legitimately empty collection. Verify with `show collections` when results look wrong.

**Mixing `1`s and `0`s in a projection.**
`{ name: 1, skills: 0 }` errors. It's whitelist *or* blacklist, with `_id: 0` as the only permitted mix.

**Storing dates as strings.**
`"2026-01-14"` won't sort or range-query correctly. Use `new Date()` so you get a real BSON `Date`.

---

# Module 3 — Query Operators

Operators are `$`-prefixed and nest **inside** the field, in the value position:

```js
{ age: { $gt: 25 } }
```

Field `age`, condition "greater than 25". Getting this shape wrong is the most common early syntax error.

## Comparison

```js
db.students.find({ age: { $gt: 24 } })                    // >
db.students.find({ age: { $gte: 24 } })                   // >=
db.students.find({ age: { $lt: 25 } })                    // <
db.students.find({ age: { $lte: 25 } })                   // <=
db.students.find({ age: { $ne: 24 } })                    // !=
db.students.find({ city: { $in:  ["Delhi", "Noida"] } })  // any in list
db.students.find({ city: { $nin: ["Delhi", "Noida"] } })  // none in list
```

Ranges combine two operators on one field:

```js
db.students.find({ age: { $gte: 23, $lte: 26 } })   // 23–26 inclusive
```

Two watch-outs:
- `$ne` and `$nin` also match documents where **the field doesn't exist** — a missing field is not equal to 24, so it qualifies.
- Comparisons work across types via BSON type ordering, so comparing a number to a string won't error, it'll just return nonsense. Keep types clean.

## Logical

Multiple keys are already ANDed, so `$and` is rarely needed:

```js
db.students.find({ city: "Gurugram", enrolled: true })   // implicit AND
```

Explicit `$and` is only needed for two conditions on the **same field** that can't merge into one object.

`$or` takes an **array of complete filter documents**:

```js
db.students.find({
  $or: [
    { city: "Gurugram" },
    { age: { $gt: 25 } }
  ]
})
```

Mixing AND with OR — top-level keys are ANDed, so this is "enrolled AND (Gurugram OR Delhi)":

```js
db.students.find({
  enrolled: true,
  $or: [{ city: "Gurugram" }, { city: "Delhi" }]
})
```

Also available: `$nor` (matches none) and `$not` (negates a single operator expression).

## Element operators

Because the schema is flexible, "does this field exist?" is a real question:

```js
db.students.find({ status: { $exists: true } })
db.students.find({ status: { $exists: false } })   // docs missing the field
db.students.find({ age: { $type: "string" } })     // wrong-typed data
```

`$exists: true` matches even when the value is `null`. The filter `{ status: null }` matches **both** explicit nulls and absent fields — usually not what you want. Use `$exists` when you mean existence.

`$type` is how you find dirty data — ages stored as `"24"` instead of `24`.

## Arrays

Equality looks inside arrays automatically:

```js
db.students.find({ skills: "node" })    // array CONTAINS "node"
```

### `$all` vs `$in` — the distinction

```js
db.students.find({ skills: { $all: ["react", "flask"] } })  // BOTH
db.students.find({ skills: { $in:  ["react", "flask"] } })  // EITHER
```

> `$in` compares **one field against a list of acceptable values**.
> `$all` requires **an array field to contain every listed element**.

### `$size`

```js
db.students.find({ skills: { $size: 2 } })   // exactly 2 elements
```

No range support — `$size: { $gt: 2 }` does not work.

### `$elemMatch` — the important one

Given:

```js
{
  name: "Meera",
  courses: [
    { title: "Node",  score: 88 },
    { title: "Mongo", score: 55 }
  ]
}
```

The naive query:

```js
db.students.find({ "courses.title": "Mongo", "courses.score": { $gt: 80 } })
```

**Meera matches** — even though her Mongo score is 55. Each condition is checked against the array independently: *some* element has title "Mongo" (true), *some* element has score > 80 (true, the Node one). Nothing requires them to be the same element.

```js
db.students.find({
  courses: { $elemMatch: { title: "Mongo", score: { $gt: 80 } } }
})
```

Now she's correctly excluded. `$elemMatch` forces all conditions onto a **single** array element.

**This is the single most common array-query bug in production Mongo code.**

Dot notation also indexes by position: `{ "skills.0": "node" }` matches documents whose first skill is node.

## Regex

```js
db.students.find({ name: { $regex: "^K" } })                  // starts with K
db.students.find({ name: { $regex: "ish", $options: "i" } })  // contains, case-insensitive
db.students.find({ name: /^K/i })                             // JS literal, same thing
```

Only **prefix-anchored, case-sensitive** regexes (`^K`) can use an index. Anything else scans the whole collection — fine on 100 documents, ruinous on a million. For real search use a text index or a search engine.

---

## Module 3 Exercises

```js
// 1. Aged 25 or older
db.students.find({ age: { $gte: 25 } })

// 2. Aged 24–26 inclusive
db.students.find({ age: { $gte: 24, $lte: 26 } })

// 3. From Gurugram or Noida, without $or
db.students.find({ city: { $in: ["Gurugram", "Noida"] } })

// 4. Knows BOTH react and flask
db.students.find({ skills: { $all: ["react", "flask"] } })

// 5. Exactly 2 skills
db.students.find({ skills: { $size: 2 } })

// 6. Missing the status field
db.students.find({ status: { $exists: false } })

// 7. Enrolled AND (under 25 OR from Noida)
db.students.find({
  enrolled: true,
  $or: [{ age: { $lt: 25 } }, { city: "Noida" }]
})

// 8. Name starts with K, case-insensitive, name + city only
db.students.find(
  { name: { $regex: "^k", $options: "i" } },
  { _id: 0, name: 1, city: 1 }
)

// 9. Mongo course scoring above 80
db.students.find({
  courses: { $elemMatch: { title: "Mongo", score: { $gt: 80 } } }
})
```

---

## ⚠️ Common Mistakes — Module 3

**Reaching for `$in` when you mean `$all`.**
`{ skills: { $in: ["react","flask"] } }` returns anyone who knows *either*. For *both*, you need `$all`. The two read almost identically in English, which is exactly why they get swapped. Run both against real data once and watch the result sets diverge — that's the fastest way to make it stick.

**Dropping a top-level condition when adding `$or`.**
Asked for "enrolled AND (under 25 OR Noida)", it's easy to write only the `$or` and lose `enrolled` entirely, quietly returning unenrolled students too. The `$or` array is just **another key at the top level**, sitting alongside the others:

```js
{ enrolled: true, $or: [ ... ] }
```

**The two-dotted-condition array trap.**
Covered above under `$elemMatch`. `{"courses.title": "Mongo", "courses.score": {$gt: 80}}` does not mean what it looks like it means.

**Forgetting `$ne` / `$nin` match missing fields.**
`{ status: { $ne: "active" } }` returns documents with no `status` at all. If that's not what you want, add `$exists: true`.

**Assuming `{ field: null }` means "field is absent".**
It matches explicit nulls *and* absent fields. Use `$exists: false` for genuine absence.

**Unanchored regex on a large collection.**
`{ $regex: "ish" }` cannot use an index and will scan everything.

---

# Module 4 — Update Operators

Same `{filter}, {action}` shape. Now going deep on the action side.

## Field operators

| Operator | Effect |
|---|---|
| `$set` | set or create a field |
| `$unset` | remove a field entirely |
| `$inc` | add a number (negative to subtract) |
| `$mul` | multiply |
| `$rename` | rename a field |
| `$min` | update only if the new value is **lower** than current |
| `$max` | update only if the new value is **higher** than current |

```js
db.students.updateOne({ name: "Priya" }, { $inc: { age: 1, loginCount: 1 } })
```

`$inc` on a nonexistent field creates it starting from 0 — which is why counters need no initialization.

`$unset` takes a dummy value that's ignored; convention is `""`:

```js
db.students.updateOne({ name: "Priya" }, { $unset: { status: "" } })
```

`$max` is neat for high scores: `{ $max: { highScore: 450 } }` only writes if 450 beats what's stored.

## Timestamp operators

```js
$setOnInsert   // applies only when an upsert actually inserts
$currentDate   // set a field to now
```

```js
db.students.updateOne(
  { email: "new@x.com" },
  {
    $set:          { lastSeen: new Date() },
    $setOnInsert:  { createdAt: new Date(), signupSource: "web" }
  },
  { upsert: true }
)
```

Document exists → only `lastSeen` changes. Doesn't exist → all four fields written. This is the standard way to keep a `createdAt` that never gets overwritten.

## Array operators — adding

```js
db.students.updateOne({ name: "Sneha" }, { $push:     { skills: "docker" } })  // always appends
db.students.updateOne({ name: "Sneha" }, { $addToSet: { skills: "docker" } })  // only if absent
```

> Use `$addToSet` for tags, roles, skills — anything where duplicates are meaningless.
> Use `$push` for logs and history, where duplicates are real events.

### `$push` with modifiers

```js
// push multiple
db.students.updateOne(
  { name: "Sneha" },
  { $push: { skills: { $each: ["go", "rust"] } } }
)

// capped array — keep only the last 5
db.students.updateOne(
  { name: "Sneha" },
  { $push: {
      recentLogins: {
        $each: [new Date()],
        $slice: -5
      }
  }}
)
```

`$slice: -5` keeps the last five; `$slice: 5` keeps the first five. **This is the idiomatic fix for the unbounded-array problem** from Module 1 — a capped activity list that can never approach the 16MB limit. There's also `$sort` inside `$push` for keeping an array ordered as you insert.

## Array operators — removing

| Operator | Effect |
|---|---|
| `$pull` | remove elements matching a **condition** |
| `$pullAll` | remove specific listed values |
| `$pop` | remove first (`-1`) or last (`1`) element |

```js
db.students.updateOne({ name: "Sneha" }, { $pull: { skills: "react" } })
db.students.updateMany({}, { $pull: { scores: { $lt: 40 } } })   // condition, not just value
```

`$pull` accepting a query is powerful — it removes every matching element, including objects inside an array of objects.

## Updating an element inside an array

The **positional operator `$`** holds the index of the first element matched **by the filter**:

```js
db.students.updateOne(
  { name: "Meera", "courses.title": "Mongo" },
  { $set: { "courses.$.score": 70 } }
)
```

The array field must appear in the filter, or Mongo has nothing to resolve `$` against.

Variants:

```js
"courses.$[].score"        // $[]      → ALL elements
"courses.$[elem].score"    // $[elem]  → elements matching arrayFilters
```

```js
db.students.updateOne(
  { name: "Meera" },
  { $set: { "courses.$[low].status": "retake" } },
  { arrayFilters: [{ "low.score": { $lt: 60 } }] }
)
```

`arrayFilters` is the general solution — update **every** element meeting a condition, not just the first.

## Upserts, properly

```js
db.students.updateOne(
  { name: "Arjun" },
  { $set: { city: "Pune" } },
  { upsert: true }
)
```

With no match, Mongo builds a new document from the filter's **equality conditions** plus the update — so the inserted doc gets `name: "Arjun"` and `city: "Pune"`.

**The danger:** if the filter uses operators rather than equality, or isn't specific enough, you get duplicates instead of an update. Upserts should filter on something unique.

## findOneAndUpdate

Returns the document, not just a count:

```js
db.students.findOneAndUpdate(
  { name: "Priya" },
  { $inc: { age: 1 } },
  { returnDocument: "after" }     // "before" is the default
)
```

Used constantly in Node when the API must respond with the updated record. Also **atomic** — read and write in one operation, no race condition between them.

---

## Module 4 Exercises

1. Give Priya a `loginCount` of 1 using `$inc` on a field that doesn't exist yet. Confirm it worked.
2. Add `"typescript"` to Lovish's skills, but only if it isn't already there.
3. Add both `"aws"` and `"linux"` to Khush's skills in one command.
4. Remove `"flask"` from whoever has it.
5. Rename the `city` field to `location` for all documents.
6. Then rename it back to `city`.
7. Set `verified: false` on every student that lacks the field, leaving the rest alone.
8. Meera has a Mongo course scoring 55. Raise **just that course's** score to 75, without touching her Node course.
9. Upsert a student named `Tanya`, age 22, from Chandigarh. Run the same command twice and confirm you have exactly one Tanya.
10. Give Meera a `recentLogins` array by pushing three dates, capped so it only ever keeps the last 2.

---

## ⚠️ Common Mistakes — Module 4

**Using `$push` where `$addToSet` belongs.**
Re-running a "add this skill" endpoint twice gives you `["node", "node"]`. For set-like data, `$addToSet` is idempotent and safe to retry.

**Letting arrays grow unbounded.**
Every login appended forever eventually hits the 16MB document cap — and long before that, every read of the document drags the whole array over the network. Cap with `$slice`, or move the data to its own collection.

**Using `$` without the array field in the filter.**
`{ $set: { "courses.$.score": 70 } }` with a filter of just `{ name: "Meera" }` fails — `$` has no matched index to refer to. The filter must include a condition on the array.

**Expecting `$` to update every match.**
`$` updates only the **first** matching element. For all matches, use `$[]` or `$[elem]` with `arrayFilters`.

**Loose upsert filters creating duplicates.**
`updateOne({ name: { $regex: "tanya", $options: "i" } }, {...}, { upsert: true })` can insert a new document every run. Upsert filters should be equality on a unique field.

**Putting `createdAt` in `$set` on an upsert.**
It gets overwritten on every subsequent update. Use `$setOnInsert`.

**Reading, then writing, in two steps.**
Fetching a document, computing a new value in JS, then writing it back opens a race window where another process changes it in between. `$inc`, `$max`, and `findOneAndUpdate` are atomic — let the server do it.

---

## Quick Reference

### Query operators

```
$eq $ne $gt $gte $lt $lte        comparison
$in $nin                          list membership
$and $or $nor $not                logical
$exists $type                     element
$all $size $elemMatch             array
$regex                            pattern
```

### Update operators

```
$set $unset $inc $mul $rename $min $max     fields
$setOnInsert $currentDate                   upsert / time
$push $addToSet $each $slice $sort          array — add
$pull $pullAll $pop                         array — remove
$  $[]  $[elem] + arrayFilters              positional
```

### Method cheat sheet

```js
insertOne(doc)                      insertMany([docs], {ordered})
find(filter, projection)            findOne(filter, projection)
countDocuments(filter)              estimatedDocumentCount()
updateOne(filter, update, opts)     updateMany(filter, update, opts)
replaceOne(filter, doc)             findOneAndUpdate(filter, update, {returnDocument})
deleteOne(filter)                   deleteMany(filter)
drop()                              renameCollection(name)
```

---

**Next up — Module 5: Cursors.** Sorting, `limit`, `skip`, pagination, and why `skip()` is a trap at scale.
