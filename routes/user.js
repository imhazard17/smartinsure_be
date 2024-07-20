const router = require("express").Router;
const upload = require('../middlewares/multer')
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const router = require("express").Router;
const auth = require('../middlewares/authentication')
const bcrypt = require('bcrypt')

// GET /user/details/:userId  ==> only for Claim assessor
router.get('/details/:userId', auth, errForward(async (req, res) => {
    if(req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            id: req.params.userId,
        },
        include: {
            policies: true,
            policies: {
                include: {
                    claim: true
                }
            },
            email: true,
            firstName: true,
            lastName: true,
            dob: true,
            role: true,
            address: true,
            phone: true
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    return res.status(200).json(user)
}))

// GET /user/my-details
router.get('/my-details', auth, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            id: req.locals.userId,
        },
        include: {
            policies: true,
            policies: {
                include: {
                    claim: true
                }
            },
            email: true,
            firstName: true,
            lastName: true,
            dob: true,
            role: true,
            address: true,
            phone: true
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    return res.status(200).json(user)
}))

// DELETE /user/delete-account
router.delete('/delete-account', auth, errForward(async (req, res) => {
    const user = await prisma.user.delete({
        where: {
            id: req.locals.userId,
            password: bcrypt.hashSync(req.body.password, 10),
        },
        select: {
            id: true,
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error deleting user'
        })
    }

    return res.status(200).json({
        msg: 'User deleted successfully'
    })
}))

// PUT /user/promote-to-claim-assessor/:userId
router.put('/promote-to-claim-assessor/:userId', auth, errForward(async (req, res) => {
    if(req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const resp = await prisma.user.update({
        data: {
            role: "CLAIM_ASSESSOR"
        },
        where: {
            userId: req.params.userId,
        },
        include: {
            id: true,
            role: true
        }
    })

    return res.status(200).json({
        msg: 'User promoted to claim assessor successfully',
        ...resp
    })
}))

module.exports = router
