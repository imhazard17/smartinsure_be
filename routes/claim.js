const router = require("express").Router;
const auth = require("../middlewares/authentication");
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')

// GET /claim/my-claims
router.get('/my-claims', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findMany({
        where: {
            userId: req.locals.userId
        },
        include: {
            report: true,
            documents: true
        }
    })

    if(!claim) {
        return res.status(400).json({
            err: 'No claims yet'
        })
    }

    return res.status(200).json(claim)
}))

// GET /claim/:id
router.get('/:id', errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.id
        },
        include: {
            report: true,
            documents: true
        }
    })

    if(!claim) {
        return res.status(400).json({
            err: 'No such claim found'
        })
    }

    if (claim.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to access this claim'
        })
    }

    return res.status(200).json(claim)
}))

// GET /claim/user/:userId
router.get('/claim/user/:userId', errForward(async (req, res) => {
    const claims = await prisma.claim.findMany({
        where: {
            id: req.params.userId
        },
        include: {
            report: true,
            documents: true
        }
    })

    if(!claims) {
        return res.status(400).json({
            err: 'No such claims found'
        })
    }

    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to access claims'
        })
    }

    return res.status(200).json(claims)
}))

// POST /claim/new/:policyId
router.post('/new', errForward(async (req, res) => {
    const claim = await prisma.claim.create({
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: req.body.dateOfIntimation,
            desc: req.body.desc,
            policyId: req.params.policyId,
            userId: req.locals.userId
        },
        select: {
            id: true
        }
    })

    if(!claim) {
        return res.status(500).json({
            err: 'Failed to create claim'
        })
    }

    if (req.locals.role === "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Only policy holders can make claims'
        })
    }

    return res.status(200).json(claim)
}))

// PUT /claim/update/:id
router.put('/update/:id', errForward(async (req, res) => {
    const claim = await prisma.claim.update({
        where: {
            id: prisma.claim.id,
            userId: req.locals.userId
        },
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: req.body.dateOfIntimation,
            desc: req.body.desc,
        },
        select: {
            id: true
        }
    })

    if(!claim) {
        return res.status(500).json({
            err: 'Failed to update claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${claim.id} updated successfully`
    })
}))

// DELETE /claim/delete/:id
router.delete('/delete/:id', errForward(async (req, res) => {
    const claim = await prisma.claim.delete({
        where: {
            id: req.params.id,
            userId: req.locals.userId,
        },
        select: {
            id: true
        }
    })

    if(!claim) {
        return res.status(500).json({
            err: 'Failed to delete claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${claim.id} deleted successfully`
    })
}))

module.exports = router
