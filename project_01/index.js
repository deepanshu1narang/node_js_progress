const express = require("express");
const users = require("./MOCK_DATA.json");
const products = require("./MOCK_PRODUCTS.json");

const app = express();
const PORT = 8000;

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
    let result = {
        statusCode: 200,
        data: users,
        status: "OK",
        total: users.length,
    }
    return resp.json(result);
});

// dynamic path parameters
app.get("/api/users/:id", (req, resp) => {
    const id = Number(req.params.id);
    // req.query for query params and req.params for path params
    const user = users.find(user => user.id === id);
    let result = {
        statusCode: 200,
        data: user,
        status: "OK",
    }
    resp.json(result);
});

app.post("/api/users", (req, resp) => {
    // TODO: create user
    return resp.json({ "status": "pending" });
});

app.patch("./api/users/:id", (req, resp) => {
    // TODO: edit user with id
    return resp.json({ "status": "pending" });
});

app.delete("./api/users/:id", (req, resp) => {
    // TODO: delete user with id
    return resp.json({ "status": "pending" });
});

// here i wrote get by id, patch and delete as 3 routed but route is same right?
// let's use other api (say products) ---> as get by id, patch by id and delete by id

app
    .route("/api/products/:id")
    .get((req, resp) => {
        const id = Number(req.params.id);
        const product = products.find(prod => prod.id === id);
        let result = {
            statusCode: 200,
            data: product,
            status: "OK",
        }
        resp.json(result);
    })
    .patch((req, resp) => {
        // TODO: edit product with id
        return resp.json({ "status": "pending" });
    })
    .delete((req, resp) => {
        // TODO: delete product with id
        return resp.json({ "status": "pending" });
    });

app.listen(PORT, () => `Server started at ${PORT}`);
