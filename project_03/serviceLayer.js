function crearteUser(body){
    return {
        firstName: body.firstname,
        lastName: body.lastname,
        email: body.email,
        jobTitle: body.jobTitle,
        gender: body.gender
    }
}

module.exports = { crearteUser };