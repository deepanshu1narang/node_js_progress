const fs = require('fs');

console.log("hello world");

fs.writeFileSync("abc1.txt", "Hello world with fs synchronously");

fs.writeFile("abc2.txt", "Hello world with fs asynchronously", (err) => {
    if(err)
        console.log(err);
});

const result = fs.readFileSync("./abc1.txt", "utf-8");
console.log("readAsync>>>", result);

fs.readFile("./abc2.txt", "utf-8", (err, res) => {
    if(err)
        console.log("err>>>>>", err);
    
    else if(res)
        console.log("read>>>>", res);

    else
        console.log("something unexpected happened!!");
})