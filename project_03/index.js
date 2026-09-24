const express = require("express");
const mongoose = require("mongoose");

const { PORT, STATUSES } = require("./constants");
const { userSchema } = require("./schema");
const { crearteUser } = require("./serviceLayer");
const { testMiddleWare } = require("./middlewares");

const app = express();

// mongo connection
mongoose
  .connect("mongodb://127.0.0.1:27017/project-03")
  .then(() => console.log("Mongo DB connected!"))
  .catch((err) => console.log("mongo errors", err));

// middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ extended: false })); // for raw json files

// schema - userScheme already created

// model
const User = mongoose.model("user", userSchema);

// routes

app
  .route("/api/users")
  .get(testMiddleWare, async (req, res) => {
    const users = await User.find({});

    res.status(200).json({
      message: "Users fetched successfully",
      data: users,
      status: STATUSES.success,
    });
  })
  .post(async (req, res) => {
    const body = req.body;
    console.log(body);
    if (!body)
      return res.status(400).json({
        message: "unable to read payload",
        status_code: 400,
        status: STATUSES.failure,
      });

    const result = await User.create(crearteUser(body));

    return res.status(201).json({
      message: "User added successfully",
      data: result,
      status: STATUSES.success,
    });
  });

app
  .route("/api/users/:id")
  .get(async (req, res) => {
    const id = req.params.id;

    const user = await User.findById(id);

    if (!user)
      return res.status(404).json({
        status: STATUSES.failure,
        message: "user not found",
      });

    return res.status(200).json({
      data: user,
      message: "user found",
      status: STATUSES.success,
    });
  })
  .patch(async (req, res) => {
    const body = req.body;
    const id = req.params.id;

    await User.findByIdAndUpdate(id, {
      lastName: body.lastname,
    });

    return res.status(201).json({
      message: "user data updated successfully",
      status: STATUSES.success,
    });
  })
  .delete(async (req, res) => {
    const id = req.params.id;

    await User.findByIdAndDelete(id);

    return res.status(201).json({
      message: "user deleted successfully",
      status: STATUSES.success,
    });
  });

app.listen(PORT, () => console.log(`server started at PORT: ${PORT}`));
