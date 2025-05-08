const express = require("express");
const users = require("./MOCK_DATA.json");
const products = require("./MOCK_PRODUCTS.json");
const fs = require("fs");
const mongoose = require("mongoose");

const app = express();
const PORT = 8000;

// we'll see mongo db also in the same project

// Connection of mongoose with our db
// it is an async function

// mongoose.connect(url/db_name).then(() => fn1()).catch(err => console.log(err));
mongoose.connect("mongodb://127.0.0.1:27017/sample_db")
    .then(() => console.log("Mongo DB connected"))
    .catch(err => console.log(err));

// Schema
const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    gender: {
        type: String
    }
}, { timestamps: true }); //schema is ready/defined

// let's create a model for this schema
const User = mongoose.model("user", userSchema);



//  middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ extended: false })); // for raw json files
// app.use(express.raw({ type: '*/*', limit: '10mb' }));

// custom middlewares 
app.use((req, resp, next) => {
    console.log("hello from middleware1");
    // making changes to req
    req.addedChange = "it's a change just to check the power of middleware1";
    // creating logs inside middleware
    fs.appendFile("logs.txt", `${Date.now()}: ${req.method}: ${req.path}\n`, (err, data) => {
        next(); /// it means execute it to the next function
    })
});

app.use((req, resp, next) => {
    console.log("hello from middleware2");
    console.log(req.addedChange);
    // console.log(resp.json || "undef");.... this is wrong.. basically response.json(arg) means .. send arg as response to client
    next();
})


// middleware works from top to bottom


// ROUTES
app.get("/", (req, resp) => {
    resp.send("home page");
});

app.get("/users", (req, resp) => {
    const html = `
        <ul>
            ${users.map(user => `<li>
                ${user.firstname}
            </li>`).join("")}
        </ul>
    `;
    return resp.send(html);
})

app.get("/api/users", (req, resp) => {
    console.log("I am in get route", req.addedChange);
    // resp.setHeader("devName", "Deepanshu Narang");
    // resp.removeHeader("devName");
    resp.setHeader("X-dev-name", "Deepanshu Narang");
    // always add an X before creating custom header   ... devName ❌ X-dev-name  ✅ or even X-devName is aslo correct.... without X are generally considered to be built-in header

    // check for some built-in headers on google

    console.log(req.headers);
    let result = {
        data: users,
        total: users.length,
    }
    return resp.status(200).json(result);
});

// dynamic path parameters
app.get("/api/users/:id", (req, resp) => {
    const id = Number(req.params.id);
    // req.query for query params and req.params for path params
    const user = users.find(user => user.id === id);
    if (!user) {
        return resp.status(404).json({ data: null, message: "user doesn't exist" });
    }
    let result = {
        data: user,
        message: "user's name is " + user.firstname + " " + user.lastname
    }
    resp.status(200).json(result);
});

app.post("/api/users", (req, resp) => {
    const body = req.body;
    if (!body || !body.firstname || !body.lastname) {
        return resp.status(400).json({ "message": "at least firstname and lastname are required" });
    }
    // console.log(body);
    const newUser = {
        ...body,
        address: JSON.parse(body.address),
        id: users[users.length - 1].id + 1
    };
    users.push(newUser);
    fs.writeFile("./MOCK_DATA.json", JSON.stringify(users), (err, data) => {
        console.log(err);
        return resp.status(201).json({ "message": `Success! ${newUser.firstname} ${newUser.lastname} added to the list successfully` });
    })

});

app.patch("/api/users/:id", (req, resp) => {
    const id = Number(req.params.id);
    const userIdx = users.findIndex(e => e.id === id);
    if (userIdx === -1) {
        return resp.status(404).json({
            message: `user with ${req.params.id} does not exist!`,
            data: null
        });
    }
    else {
        const user = users[userIdx];
        for (let key in req.body) {
            user[key] = req.body[key];
        }
        users[userIdx] = user;

        fs.writeFile("./MOCK_DATA.json", JSON.stringify(users), (err, data) => {
            console.log(err);
            return resp.status(201).json({
                data: user,
                message: `User with id ${req.params.id} got modified!`
            });
        });
    }
});

app.delete("/api/users/:id", (req, resp) => {
    const id = Number(req.params.id);
    const userIdx = users.findIndex(e => e.id === id);
    if (userIdx === -1) {
        return resp.status(404).json({
            message: `user with ${req.params.id} does not exist!`,
            data: null
        });
    }
    else {
        users.splice(userIdx, 1);
        fs.writeFile("./MOCK_DATA.json", JSON.stringify(users), (err, data) => {
            console.log(err);
            return resp.status(200).json({
                data: null,
                message: `User with id ${req.params.id} got removed!`
            });
        });
    }
});

// here i wrote get by id, patch and delete as 3 routed but route is same right?
// let's use other api (say products) ---> as get by id, patch by id and delete by id

app
    .route("/api/products/:id")
    .get((req, resp) => {
        const id = Number(req.params.id);
        const product = products.find(prod => prod.id === id);
        let result = {
            data: product,
            message: "Products fetched"
        }
        resp.status(200).json(result);
    })
    .patch((req, resp) => {
        const id = Number(req.params.id);
        const productIdx = products.findIndex(e => e.id === id);
        if (productIdx === -1) {
            return resp.status(404).json({
                message: `product with ${req.params.id} does not exist!`,
                data: null
            });
        }
        else {
            const product = products[productIdx];
            for (let key in req.body) {
                product[key] = req.body[key];
            }
            products[productIdx] = product;

            fs.writeFile("./MOCK_PRODUCTS.json", JSON.stringify(products), (err, data) => {
                console.log(err);
                return resp.status(200).json({
                    data: product,
                    message: `Product with id ${req.params.id} got modified!`
                });
            });
        }
    })
    .delete((req, resp) => {
        const id = Number(req.params.id);
        const productIdx = products.findIndex(e => e.id === id);
        if (productIdx === -1) {
            return resp.status(404).json({
                message: `product with ${req.params.id} does not exist!`,
                data: null
            });
        }
        else {
            products.splice(productIdx, 1);
            fs.writeFile("./MOCK_PRODUCTS.json", JSON.stringify(products), (err, data) => {
                console.log(err);
                return resp.status(200).json({
                    data: null,
                    message: `product with id ${req.params.id} got removed!!!`
                });
            });
        }
    });

// creating some new routes so that I can keep mongo learning separate
app.route("/sampleDB/users")
    .get(async (req, resp) => {
        const allDBusers = await User.find({});
        // just like SELECT * FROM <table>
        return resp.status(200).json(allDBusers);
        //similar if you wanna send html
    })
    .post(async (req, resp) => {
        const body = req.body;
        if (!body || !body.firstname || !body.lastname) {
            return resp.status(400).json({ "message": "at least firstname and lastname are required" });
        }

        const { firstname, lastname, email, phone, gender } = body;

        const result = await User.create({
            firstname,
            lastname,
            email,
            phone,
            gender
        });

        console.log("result", result);

        return resp.status(201).json({ message: "Success" });
    });

app.route("sampleDB/users/:id")
    .get((req, resp) => {

    })

app.listen(PORT, () => `Server started at ${PORT}`);

// app methods (server methods) --> use (middleware), get, post , put, patch, delete (for calling apis/routes), listen (to run the server)