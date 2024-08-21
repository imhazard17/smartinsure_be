const router = require("express").Router();
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken')
const z = require('zod')
const validator = require('validator')
const convertibleToNum = require('../utils/zod_helper')
require('dotenv').config()

function addMinutesToDate(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// GET /auth/send-otp/:email
router.get('/send-otp/:email', errForward(async (req, res) => {
    // check if email already used
    // if not delete all otps on that email previously then send otp to the mail
    if (!z.string().email().safeParse(req.params.email).success) {
        return res.status(400).json({
            err: 'Invalid email'
        })
    }

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

    const code = getRandomInt(100000, 999999).toString()

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_APP_PASSWORD,
        }
    });

    var mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: req.params.email,
        subject: 'OTP for SmartInsure signup',
        text: `The otp for SmartInsure is: ${code}\n\nONLY VALID FOR ${process.env.MINUTES_TO_EXPIRE_OTP} MINUTES\n\nDO NOT SHARE WITH ANYBODY`
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
                expireAt: addMinutesToDate(new Date(), process.env.MINUTES_TO_EXPIRE_OTP)
            }
        })

        return res.status(200).json({
            email: req.params.email,
            msg: 'Sucessfully sent otp'
        })
    });
}))

// POST /auth/signup
router.post('/signup', errForward(async (req, res) => {
    // while signup verify email takes email and generates otp which is valid for next 5 mins
    // first take the user signup details send them as req body to this endpt
    // then accept otp and see if it matches the otp with the email with exp time less than current time
    // if yes create new user

    if (req.body.password !== req.body.confirmPassword) {
        return res.status(400).json({
            err: 'The password entered does not match the confirm password'
        })
    }

    const authSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(3),
        lastName: z.string().min(3),
        dob: z.string().date(),
        address: z.string().min(10),
        phone: z.string().refine(validator.isMobilePhone),
        otp: z.string().length(6).refine(convertibleToNum)
    })

    if (!authSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs entered'
        })
    }

    const emailExists = await prisma.user.findUnique({
        where: {
            email: req.body.email
        },
        select: {
            id: true
        }
    })

    if (emailExists) {
        return res.status(400).json({
            err: `user already exists with email ${req.body.email}`
        })
    }

    const emailInPolicy = await prisma.policy.findFirst({
        where: {
            emails: {
                has: req.body.email
            }
        },
        select: {
            id: true
        }
    })

    if (!emailInPolicy) {
        return res.status(400).json({
            err: `No policies for email: ${req.body.email} in our databses yet`
        })
    }

    const validOtp = await prisma.otp.findFirst({
        where: {
            email: req.body.email,
            code: req.body.otp,
            expireAt: {
                gt: new Date()
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
            dob: new Date(req.body.dob).toISOString(),
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
        msg: `successfully created account with id: ${createdUser.id}`,
        authToken: token
    })
}))

// POST /auth/login
router.post('/login', errForward(async (req, res) => {
    const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
    })

    if (!loginSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs entered'
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            email: req.body.email
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
        msg: `successfully logged into account with user id: ${user.id}`,
        authToken: token
    })
}))

module.exports = router
