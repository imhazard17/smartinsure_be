const router = require("express").Router();
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");

// GET /policy/:policyNumber
router.get('/:policyNumber', auth, errForward(async (req, res) => {
    const policy = await prisma.policy.findUnique({
        where: {
            policyNumber: +req.params.policyNumber
        },
        include: {
            claims: {
                select: {
                    id: true
                }
            }
        }
    })

    const user = await prisma.user.findUnique({
        where: {
            id: req.locals.userId
        },
        select: {
            email: true
        }
    })

    if(!user) {
        return res.status(500).json({
            err: 'Could not find user'
        })
    }

    if (!policy) {
        return res.status(404).json({
            err: 'Could not find the policy'
        })
    }

    if (!Array.from(policy.emails).includes(user.email) && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'No policies found for you account'
        })
    }

    delete policy.emails
    return res.status(200).json({ msg: policy })
}))

// GET /policy/policyNumbers/:userId
router.get('/policyNumbers/:userId', auth, errForward(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {
            id: +req.params.userId
        },
        select: {
            email: true
        }
    })
    if(!user) {
        return res.status(400).json({
            err: 'No such user found'
        })
    }

    const policyNumbers = await prisma.policy.findMany({
        where: {
            emails: {
                has: user.email
            }
        },
        select: {
            policyNumber: true
        }
    })

    if(!policyNumbers) {
        return res.status(500).json({
            err: 'Error in fetching policy numbers'
        })
    }

    return res.status(200).json({
        msg: policyNumbers
    })
}))

// GET /policy/hosp/all-codes
router.get('/hosp/all-codes', auth, errForward(async (req, res) => {
    const hosps = await prisma.hosp.findMany({
        select: {
            code: true
        }
    })

    if(!hosps) {
        return res.status(500).json({
            err: 'Error fetching hospitals'
        })
    }

    return res.status(200).json({
        msg: hosps
    })
}))

// GET /policy/hosp/:hospCode
router.get('/hosp/:hospCode', auth, errForward(async (req, res) => {
    const hosp = await prisma.hosp.findFirst({
        where: {
            code: req.params.hospCode
        }
    })
    if(!hosp) {
        return res.status(400).json({
            err: 'No hospital with such code found'
        })
    }

    return res.status(200).json({
        msg: hosp
    })
}))

module.exports = router
