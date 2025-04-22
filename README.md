this is so that I can track my daily progress onn github

# Day 1 -- 20 apr 2025> ::===>>>

What is NodeJS?

> > > V8 embedded with C++... now JS can be executed outside browser too. JS can talk to native machine (bcoz of C++) too with this (example fs module).
> > > We can build web servers also in node js
> > > basically Nodejs is neither a library nor a framework, node js is a runtime environment for JavaScript.
> > > V8 not directly embedded... DOM features were removed and some were added

npm init ---> we can install dependencies.

MODULES: just modular programming ... that's it
we can either create 1. custom modules (basically functions) 2. built-in modules 3. 3rd party packages

FILE SYSTEM:
const fs = require("fs");
read, write, copy, mkdir etc (both sync and async) ---> for asynv just write the funciton name and for sync write sync also
eg -> fs.writeFileSync (sync), fs.writeFile (async)

NODE JS architecture

(go thru the video multiple times to understand it clearly)
it takes 2 types of requests --- blocking (sync) and non-blocking (Async)
non-blocking requests sun smoothly

blocking requests require a thread pool (ie some workers)
generally a thread pool has 4 workers
max workers it can have the number of cores in cpu (or the number of cpu)
how o calculate ---> os.cpus().length

# Day 2 -- 21 apr 2025> ::===>>>

Creating HTTP server
handling url in node js
url = protocol + domain + path + query parameters
example:
https://wwww.google.com/search?q=javascript+interview+questions&source=hp&ei=Ndffd-DKsd
Protocol => https:
Domain => www.google.com
Path => /search
Query Params =>
q = javascript+interview+questions
source = hp
ei = Ndffd-DKsd

request.url (request a param from createServer callback function that handles requests) doesn;t know that after ? it starts query params... basically it doesn't know the breakdown

for this we need a module called url (from outside)

# shift 2 on day 2

HTTP methods
GET
POST
PATCH
PUT
DELETE

# Day 3 22 apr 2025 >>>>

As applications grow, managing multiple routes, middleware, and request handling using Node’s core http module quickly becomes messy and repetitive.

Express is a minimalistic and flexible web framework built on top of Node.js that helps structure your backend code in a clean, scalable, and organized way.

It provides:

A simplified syntax for handling routes, requests, and responses

Built-in support for middleware, which adds modularity and reusability

Clean handling of query parameters, route params, and JSON payloads

Better error handling and more maintainable code structure

Support for powerful extensions like Express Router for modular routing

In short, Express makes backend development faster, cleaner, and more maintainable, especially as your app grows.

simply

<!-- routes written as -->

app.method(path, handler); >>>> handler = (req, resp) => {....}

app.listen(port, callback);

# VERSIONING

"dependencies": {
"express": "^5.1.0",
"url": "^0.11.4"
}

we'll discuss for the express version ie ^5.1.0

1st part -> 5
3rd part (last part) -> 0 --- minor fixes (optional);
suppose tomorrow they release 5.1.1 or 5.1.2 ..... this'll be for small bug only

2nd part -> 1 (latest) recommended bug fix or security fix or some new features are added

1st part -> 5 (major release) major and breaking update

^ --> (called as carat symbol) suppose the version being used is ^4.18.2 if i do npm i
if express releases 4.18.2 or 4.18.3 or 4.19.1 or 4.20.0 ---> it'll install all recommended and minor fixes (2nd and 3rd part)
but it'll never touch 4
suppose it releases 5.0.0 ---> don't update it

~4.18.1 on npm i it'll change only to 4.18.2 or 4.18.3 but it won't touch 18 too
https://docs.npmjs.com/cli/v11/configuring-npm/package-json
example {
"dependencies": {
"foo": "1.0.0 - 2.9999.9999",
"bar": ">=1.0.2 <2.1.2",
"baz": ">1.0.2 <=2.3.4",
"boo": "2.0.1",
"qux": "<1.0.0 || >=2.3.1 <2.4.5 || >=2.5.2 <3.0.0",
"asd": "http://npmjs.com/example.tar.gz",
"til": "~1.2",
"elf": "~1.2.3",
"elf1": "^1.2.3",
"two": "2.x",
"thr": "3.3.x",
"lat": "latest",
"dyl": "file:../dyl",
"kpg": "npm:pkg@1.0.0"
}
}

# Rest API

project with GET DONE
need to install postman for post, patch and delete
