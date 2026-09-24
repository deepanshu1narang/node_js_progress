const fs = require('fs');

function testMiddleWare(req, res, next) {
    console.log(`test middleware in ${req.url} ${req.method}`);
    next();
}

function apiLoggerMiddleware(fileName) {
    return (req, res, next) => {
        fs.appendFile(fileName, JSON.stringify({
            url: req.url,
            method: req.method,
            path: req.path,
            params: req.params,
            query: req.query,
            headers: req.headers,
            body: req.body,
            ip: req.ip,
            requestTime: new Date().toString()
        }, null, 2) + "\n______________________________________________\n", (err, data) => {
            if (err)
                console.log(err);

            next();
        });
    }
}

module.exports = { testMiddleWare, apiLoggerMiddleware };