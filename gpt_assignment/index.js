const express = require("express");
const fs = require("fs");

const PORT = 8080;
const app = express();

// routes
app.get("/greet", (req, resp) => resp.send(`Hello ${req.query.name}!`));
app.get("/user/:id", (req, resp) => resp.send(`user id is ${req.params.id}`));
// idk post and download right now
app.post("/data", (req, res) => {
    // 
});

app.get("/download", (req, res) => {
    fs.writeFile("download.txt", "file downloaded", (err) => console.log(err));
    // idk how to download
})

app.listen(PORT, () => "server started");