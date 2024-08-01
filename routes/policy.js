const router = require("express").Router();
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");

// policy can be written only by claim assessor and read by both policy holder and claim assessor

// GET /policy/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const policy = await prisma.policy.findUnique({
        where: {
            id: req.params.id
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    id: true,
                }
            },
            claim: {
                include: {
                    id: true
                }
            }
        }
    })

    if(policy.user.id !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient privilages to access'
        })
    }

    if(!policy) {
        return res.status(404).json({
            err: 'Could not find the policy'
        })
    }

    return res.status(200).json(policy)
}))

// GET /policy/list/:userId
router.get('/list/:userId', auth, errForward(async (req, res) => {
    const policies = await prisma.policy.findMany({
        where: {
            userId: req.params.userId,
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    id: true,
                }
            },
            claim: {
                include: {
                    id: true
                }
            }
        }
    })

    if(policies.user.id !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient privilages to access'
        })
    }

    if(!policies) {
        return res.status(404).json({
            err: 'Could not find the policy'
        })
    }

    return res.status(200).json(policies)
}))

// POST /policy/new
router.post('/new', auth, errForward(async (req, res) => {
    if(req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const newPolicy = await prisma.policy.create({
        data: {
            hospName: req.body.hospName,
            hospCity: req.body.hospCity,
            desc: req.body.desc,
            userId: req.body.userId,
        },
        select: {
            id: true
        }
    })

    if(!newPolicy) {
        return res.status(500).json({
            err: 'failed to create policy'
        })
    }

    return res.status(200).json({
        msg: `Successfully created new policy with id: ${newPolicy.id}`,
    })
}))

// DELETE /policy/delete/:id
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    if(req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to make this action'
        })
    }

    const deletedPolicy = await prisma.policy.delete({
        where: {
            id: req.params.id
        },
        select: {
            id: true
        }
    })

    if(!deletedPolicy) {
        return res.status(500).json({
            err: 'failed to delete policy'
        })
    }

    return res.status(200).json({
        msg: `Successfully deleted policy with id: ${deletedPolicy.id}`,
    })
}))

module.exports = router
