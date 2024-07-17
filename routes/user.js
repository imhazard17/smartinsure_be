const router = require("express").Router;
const upload = require('../middlewares/multer')
const errForward = require('../utils/errorForward')
const prisma = require('../utils/db')
const router = require("express").Router;
const auth = require('../middlewares/authentication')
const fs = require('node:fs/promises')

// GET /user/details/:userId  ==> only for Claim assessor
router.get('/details/:userId', auth, errForward(async (req, res) => {}))

// GET /user/my-details
router.get('/my-details', auth, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            id: req.locals.userId,
        },
        include: {
            tasks: true,
            schedules: true,
            _count: {
                select: {
                    tasks: true,
                    schedules: true
                }
            },
            streaks: {
                some: {
                    endDate: null,
                }
            },
        }
    })

    if (!user) {
        return res.status(404).json({
            err: 'Error getting user details'
        })
    }

    delete user.password
    return res.status(200).json(user)
}))

// PUT /user/change-details
router.put('/change-details', auth, uplUserValidtn, upload.single('file'), errForward(async (req, res) => {
    const userId = req.locals.userId

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            dpUrl: true,
        }
    })

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            username: req.headers.username,
            bio: req.headers.bio,
            password: req.headers.password,
            firstName: req.headers.firstName,
            lastName: req.headers.lastName,
            doj: req.headers.doj,
            dpUrl: req.file?.path,
        }
    })

    if (!updatedUser) {
        return res.status(404).json({
            err: 'Could not update user details'
        })
    }

    if(user) {
        fs.unlink(user.dpUrl)
    }

    delete updatedUser.password
    return res.status(200).json(updatedUser)
}))

// DELETE /user/delete-account
router.delete('/delete-account', auth, errForward(async (req, res) => {
    const user = await prisma.user.delete({
        where: {
            id: req.locals.userId,
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
        err: 'User deleted successfully'
    })
}))

module.exports = router
