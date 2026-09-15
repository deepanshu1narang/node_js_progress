function testMiddleWare(req, res, next){
    console.log(`test middleware in ${req.url} ${req.method}`);
    next();
}

module.exports = { testMiddleWare };