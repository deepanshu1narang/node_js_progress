const express = require('express');
const fs = require('fs');
const { PORT, logApiCalled, STATUSES } = require('./constants');
const usersData = require("../MOCK_DATA/MOCK_USERS_DATA_COMPACT.json");
const products = require("../project_01/MOCK_PRODUCTS.json");
const { demoMiddleware1, apiLoggerMiddleware, pageAndLimitCheckerMiddleware, addUserMiddleware, userValidatorMiddleware } = require("./middlewares");

const app = express();

// middlewares - plugins
// app.use means the universal middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ extended: false })); // for raw json files
app.use((req, res, next) => {
    console.log("hello from middleware 1");
    next();
});
app.use(demoMiddleware1);
app.use(apiLoggerMiddleware);

// middlewares must always be above route files

// functions
function getUsers(req, res) {
    const { page, limit } = req.query;

    let startIndex = 0;
    startIndex = (page - 1) * limit;

    const data = usersData.slice(startIndex, startIndex + Number(limit));

    const response = {
        count: data.length,
        status_code: data.length > 0 ? 200 : 404,
        data,
        message: data.length > 0 ? "users fetched" : "no users",
        pages: Math.ceil(usersData.length / limit),
        status: data.length > 0 ? STATUSES.success : STATUSES.failure
    }
    return res.status(200).json(response);
}

const getProfile = (req, res) => {
    res.json({ user: req.user, status_code: 200, status: STATUSES.success }); // { id: 1, name: "Deepanshu", role: "admin" }
}

// functions

// ROUTES
app.get("/", (req, res) => {
    res.send("home page");
});

app.get("/users", (req, res) => {
    // logApiCalled(req);
    const html = `
        <ol>
            ${usersData.map(user => `
                <li> ${user.id}
                    <ul type="none">
                        <li>${user.firstname} ${user.lastname}</li>
                        <li>${user.email}</li>
                        <li>${user.phone}</li>
                        <li>${user.gender}</li>
                    </ul>
                </li>
            `).join("")}
        </ol>
    `;
    return res.send(html);
});

app.get("/api/users", pageAndLimitCheckerMiddleware, getUsers);

// app.get("/api/users/:id", userValidatorMiddleware, (req, res) => {
app.get("/api/users/:id", (req, res) => {
    // logApiCalled(req);
    const id = Number(req.params.id);
    const user = usersData.find(u => u.id === id);
    const response = {
        status_code: user ? 200 : 404,
        message: user ? "user fetched" : "no user with this id",
        data: user ?? null,
        status: user ? STATUSES.success : STATUSES.failure
    }
    // return res.status(200).json(usersData.find(u => u.id === id));
    return res.status(200).json(response);
});

// app.get("/users/filters")

app.post("/api/users", (req, res) => {
    // logApiCalled(req);

    const body = req.body;
    console.log(body);
    if (!body)
        return res.status(400).json({
            message: "unable to read payload",
            status_code: 400,
            status: STATUSES.failure
        });

    const id = Number(usersData[usersData.length - 1].id) + 1;
    const users = JSON.parse(JSON.stringify(usersData));
    users.push({ ...body, id });

    fs.writeFile("../MOCK_DATA/MOCK_USERS_DATA_COMPACT.json", JSON.stringify(users), (err, data) => {
        return res.status(201).json({
            status_code: 201,
            status: STATUSES.success,
            message: "User Added successfully",
            id
        });
    });
});

app.patch("/api/users/:id", (req, res) => {
    // logApiCalled(req);

    const id = Number(req.params.id);
    const body = req.body;
    const userIdx = usersData.findIndex(e => e.id === id);
    if (userIdx === -1)
        return res.status(404).json({
            status: STATUSES.failure,
            status_code: 404,
            message: "user not found"
        });

    const users = JSON.parse(JSON.stringify(usersData));
    users.splice(userIdx, 1, { ...users[userIdx], ...body });

    fs.writeFile("../MOCK_DATA/MOCK_USERS_DATA_COMPACT.json", JSON.stringify(users), (err, data) => {
        return res.status(201).json({
            status: STATUSES.success,
            status_code: 201,
            message: `Required user data has been updated`,
            id,
        });
    });
});

app.delete("/api/users/:id", (req, res) => {
    // logApiCalled(req);

    const id = Number(req.params.id);
    const userIdx = usersData.findIndex(e => e.id === id);
    if (userIdx === -1)
        return res.status(404).json({
            status: STATUSES.failure,
            status_code: 404,
            message: "user not found"
        });

    const users = JSON.parse(JSON.stringify(usersData));
    users.splice(userIdx, 1);

    fs.writeFile("../MOCK_DATA/MOCK_USERS_DATA_COMPACT.json", JSON.stringify(users), (err, data) => {
        return res.status(200).json({
            status: STATUSES.success,
            status_code: 200,
            message: `Required user has been deleted`,
            id,
        });
    });
});

// if route for some APIs is same but method is different... then ---->>>>
app.route("/api/products/:id")
    .get((req, res) => {
        // logApiCalled(req);

        const id = Number(req.params.id);
        const product = products.find(product => product.id === id);

        return res.status(200).json({
            status: product ? 200 : 404,
            data: product ?? null,
            messgae: product ? "here is the product" : "not product with this id"
        })
    })
    .patch((req, res) => {
        // logApiCalled(req);

        const id = Number(req.params.id);
        const product = products.find(product => product.id === id);
        return res.json({
            status: "pending"
        });
    })
    .delete((req, res) => {
        // logApiCalled(req);

        const id = Number(req.params.id);
        const product = products.find(product => product.id === id);
        return res.json({
            status: "pending"
        });
    });

app.get("/profile", addUserMiddleware, getProfile);


app.listen(PORT, () => console.log(`server started at PORT: ${PORT}`));