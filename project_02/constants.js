const fs = require('fs');

const PORT = 8000;

const STATUSES = {
    success: "SUCCESS",
    "failure": "FAILURE",
    pending: "PENDING"
}

module.exports = { PORT, STATUSES };