const http = require('http');
const url = require("url");
const fs = require("fs");

const myServer = http.createServer((request, response) => {
    if (request.url === "/favicon.ico")
        return response.end();

    const myUrl = url.parse(request.url, true);
    // console.log(request);
    console.log(response);
    // console.log(myUrl.query);
    // fs.writeFile("req.json", JSON.stringify(request), (err) => {
    //     if(err)
    //         console.log(err);
    //     else
    //         console.log("file written successfully");
    // });


    if(myUrl.pathname === "/greet" || myUrl.pathname === "/"){
        response.writeHead(200, { 'Content-Type': 'application/json' });
        const data = {
            ok: true,
            qwerty: 5,
        };
        if(myUrl?.query?.name)
            data.name = myUrl.query.name;

        response.end(JSON.stringify({
            status: "success",
            data,
        }));
    }
    else{
        response.writeHead(404, "not found");
        response.end(JSON.stringify({
            status: "not found",
            data: null
        }));
    }
});

myServer.listen(8080, () => console.log("server @ 8080 started"));