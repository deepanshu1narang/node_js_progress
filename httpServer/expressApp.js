// starting with express
const express = require("express");

// this app is a handler function
const app = express();

// routes
app.get("/", (request, response) => response.send("hello from Home page"));
app.get("/about", (request, response) => response.send("hello from About page"));
app.get("/search", (request, response) => response.send(`You searched for ${request.query.query}`));
// example --> http://localhost:8000/search?query=youtube
// response --> You searched for youtube
// routes

app.listen(8080, () => console.log("server (express) started"));