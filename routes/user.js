const router = require("express").Router();
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const auth = require('../middlewares/authentication')
const bcrypt = require('bcrypt');
const { z } = require("zod");

// GET /user/details/:userId  ==> only for Claim assessor
router.get('/details/:userId', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            id: +(req.params.userId),
            role: "POLICY_HOLDER",
        },
        include: {
            claims: {
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            },
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    delete user['password']
    delete user['email']

    return res.status(200).json({ msg: user })
}))

// GET /user/my-details
router.get('/my-details', auth, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            id: +(req.locals.userId),
        },
        include: {
            claims: {
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            },
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    delete user['password']
    delete user['email']

    return res.status(200).json({ msg: user })
}))

// PUT /user/delete-account
router.put('/delete-account', auth, errForward(async (req, res) => {
    if (!z.object({ password: z.string().min() }).safeParse(req.body)) {
        return res.status(400).json({
            err: 'Invalid inputs sent'
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            id: +(req.locals.userId),
        },
        select: {
            password: true,
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error deleting user'
        })
    }

    if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(404).json({
            err: 'password incorrect'
        })
    }

    const deletedUser = await prisma.user.delete({
        where: {
            id: +(req.locals.userId),
        },
        select: {
            id: true,
        }
    })

    if (!deletedUser) {
        return res.status(404).json({
            err: 'Error deleting user'
        })
    }

    return res.status(200).json({
        msg: `User with id: ${deletedUser.id} deleted successfully`
    })
}))

// PUT /user/promote-to-claim-assessor/:userId
router.put('/promote-to-claim-assessor/:userId', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const resp = await prisma.user.update({
        data: {
            role: "CLAIM_ASSESSOR"
        },
        where: {
            id: +(req.params.userId),
        },
        select: {
            id: true,
            role: true
        }
    })

    return res.status(200).json({
        msg: `User with id: ${resp.id} to role: ${resp.role}`,
    })
}))

// GET /user/get-all
router.get('/get-all', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const users = await prisma.user.findMany({
        where: {
            role: "POLICY_HOLDER"
        },
        select: {
            firstName: true,
            lastName: true,
            role: true,
            id: true
        }
    })

    if (!users) {
        return res.status(500).json({
            err: 'Error fetching users'
        })
    }

    return res.status(200).json({ msg: users })
}))

module.exports = router
