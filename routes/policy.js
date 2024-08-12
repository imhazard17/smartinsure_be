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

module.exports = router
