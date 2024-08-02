const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middlewares/authentication");
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')
const convertibleToNum = require('../utils/zod_helper')

const claimSchema = z.object({
    claimAmount: z.string().refine(convertibleToNum),
    claimType: z.literal("CASHLESS") .or(z.literal("REIMBURSEMENT")),
    dateOfIntimation: z.string().date(),
    desc: z.string().optional(),
})

// GET /claim/my-claims
router.get('/my-claims', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findMany({
        where: {
            userId: parseInt(req.locals.userId)
        },
        include: {
            report: true,
            documents: true
        }
    })

    if (!claim) {
        return res.status(400).json({
            err: 'No claims yet'
        })
    }

    return res.status(200).json(claim)
}))

// GET /claim/user/:userId
router.get('/user/:userId', auth, errForward(async (req, res) => {
    const claims = await prisma.claim.findMany({
        where: {
            userId: parseInt(req.params.userId)
        },
        include: {
            report: true,
            documents: true
        }
    })

    if (!claims) {
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

// GET /claim/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.id)
        },
        include: {
            report: true,
            documents: true
        }
    })

    if (!claim) {
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

// POST /claim/new
router.post('/new', auth, errForward(async (req, res) => {
    if(!claimSchema.safeParse(req.body)) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "POLICY_HOLDER") {
        return res.status(400).json({
            err: 'Only policy holders can make claims'
        })
    }

    const claim = await prisma.claim.create({
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: new Date(req.body.dateOfIntimation).toISOString(),
            desc: req.body.desc,
            policyId: parseInt(req.body.policyId),
            userId: parseInt(req.locals.userId)
        },
        select: {
            id: true
        }
    })

    if (!claim) {
        return res.status(500).json({
            err: 'Failed to create claim'
        })
    }

    return res.status(200).json(claim)
}))

// PUT /claim/update/:id
router.put('/update/:id', auth, errForward(async (req, res) => {
    if(!claimSchema.safeParse(req.body)) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "POLICY_HOLDER") {
        return res.status(400).json({
            err: 'Only policy holders can make claims'
        })
    }

    const claim = await prisma.claim.update({
        where: {
            id: parseInt(req.params.id),
            userId: parseInt(req.locals.userId)
        },
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: new Date(req.body.dateOfIntimation).toISOString(),
            desc: req.body.desc,
        },
        select: {
            id: true
        }
    })

    if (!claim) {
        return res.status(500).json({
            err: 'Failed to update claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${claim.id} updated successfully`
    })
}))

// DELETE /claim/delete/:id
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    if (req.locals.role !== "POLICY_HOLDER") {
        return res.status(400).json({
            err: 'Only policy holders can delete claims'
        })
    }

    const claim = await prisma.claim.delete({
        where: {
            id: parseInt(req.params.id),
            userId: parseInt(req.locals.userId),
        },
        select: {
            id: true
        }
    })

    if (!claim) {
        return res.status(500).json({
            err: 'Failed to delete claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${claim.id} deleted successfully`
    })
}))

module.exports = router
