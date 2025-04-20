const helloWorld = require('./tut_01.js/hello_world');
// normal import
const maths = require('./modules/maths');
// destructured import 
const { add, subtract } = require("./modules/maths");
const upperCase = require("./modules/upperCase");
const { fsModuleSync, fsModuleAsync, fnReadFileSync, fnReadFileAsync, fnAppendFileSync, writeHeyThere } = require("./modules/fileSystem");
const os = require("os");

console.log(upperCase("hello from index.js"));
helloWorld();

console.log(maths);
console.log(maths.add(5, 7));
console.log(maths.subtract(5, 7));
console.log(add(15, 7));
console.log(subtract(15, 7));

fsModuleSync();
fsModuleAsync();
fnReadFileSync();
fnReadFileAsync();
fnAppendFileSync();
writeHeyThere();
writeHeyThere();
writeHeyThere();
writeHeyThere();

console.log(os.cpus().length, ">>>cpus");