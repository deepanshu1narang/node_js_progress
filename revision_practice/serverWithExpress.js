const http = require('http');
const express = require('express');

const app = express();

app.get("/", (request, response) => {
    return response.send("hello from homepage!");
});

app.get("/about", (request, response) => {
    console.log(request);
    return response.send(`hello ${request.query.name} from about page`);
});

app.listen(8090, () => console.log("server with express started"));
// const serverWithExpress = http.createServer(app);
// serverWithExpress.listen(8090, () => console.log("server with express started"));