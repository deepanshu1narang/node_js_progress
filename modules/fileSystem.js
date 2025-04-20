const fs = require("fs");

function fsModuleSync() {
    fs.writeFileSync("./text.txt", "hello  2");
}

function fsModuleAsync() {
    fs.writeFile("./test2.txt", "Hello world async!", (err) => console.log("err", err));
}

function fnReadFileSync() {
    const result = fs.readFileSync("./contacts.txt", "utf-8");
    console.log(result);
}

function fnReadFileAsync() {
    console.log("read async");
    fs.readFile("./contacts.txt", "utf-8", (err, result) => {
        if (err) {
            console.log("error>>>>>>>>>.", err);
        }
        else {
            console.log("result>>>>>", result);
        }
    });
}

function fnAppendFileSync() {
    fs.appendFileSync("./text.txt", "\n" + new Date().toISOString());
}

const writeHeyThere = () => {
    fs.appendFileSync("./text.txt", "\nhey there");
}

module.exports = { fsModuleSync, fsModuleAsync, fnReadFileSync, fnReadFileAsync, fnAppendFileSync, writeHeyThere }