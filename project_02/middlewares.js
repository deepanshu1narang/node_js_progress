const fs = require('fs');

const demoMiddleware1 = (req, res, next) => {
    console.log("hello from demo middleware");
    next();
}

const apiLoggerMiddleware = (req, res, next) => {
    fs.appendFile("./console-logs.txt", JSON.stringify({
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
        if(err)
            console.log(err);

        next();
    });
}

const pageAndLimitCheckerMiddleware = (req, res, next) => {
    const { page, limit } = req.query;
    if (!page || !limit)
        return res.status(400).json({
            status_code: 400,
            status: "Bad Request",
            message: "missing mandatory parameters",
            data: {
                missing_parameters: ["page", "limit"]
            }
        });
    else
        next();
}

const addUserMiddleware = (req, res, next) => {
    req.user = { id: 1, name: "Deepanshu", role: "admin" }; // adding to req
    next();
}

const userValidatorMiddleware = (req, res, next) => {
    console.log(req.headers);
    if(req.headers['x-app-name'] === "mbpro-sales")
        next();
    else
        res.status(400).json({
            message: "Please signin to the correct app"    
        });
}

module.exports = { demoMiddleware1, apiLoggerMiddleware, pageAndLimitCheckerMiddleware, addUserMiddleware, userValidatorMiddleware };