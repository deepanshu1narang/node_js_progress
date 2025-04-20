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
