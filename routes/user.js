const router = require("express").Router();
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const auth = require('../middlewares/authentication')
const bcrypt = require('bcrypt')

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
        },
        include: {
            policies: true,
            claims: true,
            documents: true
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    delete user['password']

    return res.status(200).json({ msg: user })
}))

// GET /user/my-details
router.get('/my-details', auth, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            id: +(req.locals.userId),
        },
        include: {
            policies: true,
            claims: true,
            documents: true
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    delete user['password']

    return res.status(200).json({ msg: user })
}))

// DELETE /user/delete-account
router.delete('/delete-account', auth, errForward(async (req, res) => {
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
        msg: 'User promoted to claim assessor successfully',
        ...resp
    })
}))

module.exports = router
