// express: the web framework — gives us app.use, app.route, req/res helpers, etc.
const express = require('express');
// mongoose model for the "user" collection, defined in ./models/user
const User = require('./models/user');
// Router instance from routes/user.js — a self-contained group of routes,
// not yet tied to any URL prefix until we mount it below with app.use()
const userRouter = require('./routes/user');
const { connectMongoDB } = require('./connection');
const { apiLoggerMiddleware } = require('./middlewares');
const { PORT } = require('./constants');

// the express application — the object we attach middleware/routes to,
// and (later) call .listen() on to actually start the HTTP server
const app = express();

// DB CONNECTION
// connection to MongoDB before the app starts handling requests
connectMongoDB("mongodb://127.0.0.1:27017/mvc_tutorial")
    .then(() => console.log("Mongo DB running"));

// MIDDLEWARES
// functions that run on EVERY request before it reaches a route handler.
// order matters — these must be registered before app.use(routes) below,
// otherwise req.body would be undefined in the route handlers.
app.use(express.urlencoded({ extended: false })); // parses form-encoded bodies (e.g. HTML <form> submits) into req.body
app.use(express.json({ extended: false })); // parses JSON request bodies (e.g. Postman/fetch with Content-Type: application/json) into req.body
app.use(apiLoggerMiddleware("./logs.txt"));

// ROUTES
// mounts userRouter at the "/app/users" prefix — every path defined inside
// routes/user.js gets this prepended. e.g. router.route("/:id") becomes
// reachable at "/app/users/:id". See routes/user.js for the actual endpoints.
app.use("/api/users", userRouter);
// app.use(userRouter) if I don't wanna use any prefixes for matching

app.listen(PORT, () => console.log(`Server started at PORT: ${PORT}`));