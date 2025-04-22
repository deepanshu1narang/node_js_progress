const http = require("http");
const fs = require("fs");
const url = require("url");
// starting with http server

const myServerHandlerFunction = (request, response) => {
    // console.log(request.headers);

    if (request.url === "/favicon.ico")
        return response.end();
    // creating a log file
    const myUrl = url.parse(request.url, true);
    // 2nd arg given as true... so that we have a separate object for query
    const log = `${Date.now()}: ${request.method} ${request.url} new request received\r\n`;
    fs.appendFile("./logs.txt", log, ((error, data) => {
        switch (myUrl.pathname) {
            case "/":
                if (request.method === "GET")
                    response.end("HomePage");
                break;
            case "/about":
                const userName = myUrl.query.name;
                response.end(`Hi ${userName}`);
                break;
            case "/search":
                const search = myUrl.query.query;
                response.end(`Here are your search results: ${search}`);
                break;
            case "/signup":
                if (request.method === "GET")
                    response.end("This is a signup form.");
                else {
                    // db queries
                    response.end("Success!");
                }
                break;
            default:
                response.end("404 Not Found!");
                break;

        }
    }));

}

const myServer = http.createServer(myServerHandlerFunction);
myServer.listen(8000, () => console.log("server started"));


