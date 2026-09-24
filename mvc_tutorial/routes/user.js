const express = require('express');
const { testMiddleWare } = require('../middlewares');
const { handleGetAllUsers, handleCreateNewUser, getUserById, updateUserById, deleteUserById } = require('../controllers/user');
const router = express.Router();

router.route("/")
    .get(testMiddleWare, handleGetAllUsers)
    .post(handleCreateNewUser);


router.route("/:id")
    .get(getUserById)
    .patch(updateUserById)
    .delete(deleteUserById);

module.exports = router;