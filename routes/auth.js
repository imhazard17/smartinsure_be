const router = require("express").Router;
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const nodemailer = require('nodemailer');

function addMinutesToDate(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

// POST /auth/send-otp/:email
router.post('/send-otp/:email', errForward(async (req, res) => {
    // check if email already used
    // if not delete all otps on that email previously then send otp to the mail
    const emailExists = await prisma.user.findUnique({
        where: {
            email: req.params.email
        },
        select: {
            id: true
        }
    })

    if (emailExists) {
        return res.status(400).json({
            err: `user already exists with email ${req.params.email}`
        })
    }

    await prisma.otp.deleteMany({
        where: {
            email: req.params.email,
        }
    })

    const code = crypto.randomBytes(15).toString('hex')

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD,
        }
    });

    var mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: req.params.email,
        subject: 'OTP for SmartInsure signup',
        text: `The otp for SmartInsure is: ${code}\n\nONLY VALID FOR 5 MINUTES\n\nDO NOT SHARE WITH ANYBODY`
    };

    transporter.sendMail(mailOptions, async (error, _) => {
        if (error) {
            return res.status(500).json({
                err: 'Could not send otp'
            })
        }

        await prisma.otp.create({
            data: {
                code: code,
                email: req.params.email,
                expireAt: addMinutesToDate(new Date(), 5)
            }
        })

        return res.status(500).json({
            email: req.params.email,
            msg: 'sucessfully sent otp'
        })
    });
}))

// POST /auth/signup
router.post('/signup', errForward(async (req, res) => {
    // while signup verify email takes email and generates otp which is valid for next 5 mins
    // first take the user signup details send them as req body to this endpt
    // then accept otp and see if it matches the otp with the email with exp time less than current time
    // if yes create new user

    if(req.body.password !== req.body.comfirmPassword) {
        return res.status(400).json({
            err: 'The password entered does not match the confirm password'
        })
    }

    const validOtp = await prisma.otp.findFirst({
        where: {
            email: req.body.email,
            code: req.body.otp,
            expireAt: {
                lt: new Date()
            }
        },
        select: {
            id: true
        },
        orderBy: {
            expireAt: 'desc'
        }
    })

    if (!validOtp) {
        return res.status(400).json({
            err: 'otp incorrect or expired'
        })
    }

    const createdUser = await prisma.user.create({
        data: {
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, 10),
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            dob: req.body.dob,
            role: req.body.role,
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
router.get('/login', errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            email: req.body.username
        },
        select: {
            id: true,
            email: true,
            password: true,
            role: true,
        }
    })

    if (!user) {
        return res.status(500).json({
            err: 'email or password incorrect'
        })
    }

    if (!bcrypt.compareSync(req.body.password, user.password)) {
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
