const router = require("express").Router;
const upload = require('../middlewares/multer')
const { uplUserValidtn, userValidtn } = require('../middlewares/input_validation')
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const bcrypt = require('bcrypt')

// POST /auth/verify-email
router.post('/verify-email', uplUserValidtn, upload.single('file'), errForward(async (req, res) => {
    
}))

// POST /auth/signup
router.post('/signup', uplUserValidtn, errForward(async (req, res) => {
    const createdUser = await prisma.user.create({
        data: {
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, 10),
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            dob: req.body.dob,
            role: "POLICY_HOLDER",
            address: req.body.address,
            phone: req.body.phone,
        },
        select: {
            id: true
        },
    })

    if (!createdUser) {
        return res.status(500).json({
            err: 'Could not create account'
        })
    }

    let jwtMsg = {
        userId: createdUser.id,
        role: "POLICY_HOLDER"
    }

    const token = jwt.sign(jwtMsg, process.env.JWT_SECRET)

    return res.status(201).json({
        msg: `successfully created account with username: ${req.headers.username}`,
        authToken: token
    })
}))

// GET /auth/login
router.get('/login', userValidtn, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            email: req.body.username
        },
        select: {
            id: true,
            email: true,
            password: true
        }
    })

    if (!user) {
        return res.status(500).json({
            err: 'email or password incorrect'
        })
    }

    if (bcrypt.compareSync(req.body.password, user.password) === false) {
        return res.status(404).json({
            err: 'email or password incorrect'
        })
    }

    let jwtMsg = {
        userId: user.id,
        role: user.role,
    }

    const token = jwt.sign(jwtMsg, process.env.JWT_SECRET)

    return res.status(200).json({
        msg: `successfully logged into account with username: ${user.username}`,
        authToken: token
    })
}))

module.exports = router
