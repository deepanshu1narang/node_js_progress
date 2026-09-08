const fs = require('fs');
const fsp = require('fs/promises');

console.log("hello world");

fs.writeFileSync("abc1.txt", "Hello world with fs synchronously");

fs.writeFile("abc2.txt", "Hello world with fs asynchronously", (err) => {
    if(err)
        console.log(err);
});

const result = fs.readFileSync("./abc1.txt", "utf-8");
console.log("readSync>>>", result);

fs.readFile("./abc2.txt", "utf-8", (err, res) => {
    if(err)
        console.log("err>>>>>", err);
    
    else if(res)
        console.log("read>>>>", res);

    else
        console.log("something unexpected happened!!");
});

const asyncResult = async () => {
    const result = await fsp.readFile("./abc1.txt", "utf-8");
    console.log("async read>>", result);

    const result2 = await fsp.readFile("./abc2.txt", "utf-8");
    console.log("async read2>>", result2);
}

asyncResult();