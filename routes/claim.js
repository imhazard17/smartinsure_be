const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middlewares/authentication");
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')
const convertibleToNum = require('../utils/zod_helper')

const claimSchema = z.object({
    claimAmount: z.string().refine(convertibleToNum),
    claimType: z.string(),
    dateOfIntimation: z.string().date(),
    desc: z.string().optional(),
    policyId: z.string().refine(convertibleToNum),
})

const updateClaimSchema = z.object({
    claimAmount: z.string().refine(convertibleToNum),
    claimType: z.string(),
    dateOfIntimation: z.string().date(),
    desc: z.string().optional(),
})

// GET /claim/my-claims
router.get('/my-claims', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findMany({
        where: {
            userId: +req.locals.userId
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

    return res.status(200).json({ msg: claim })
}))

// GET /claim/user/:userId
router.get('/user/:userId', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages to access claims'
        })
    }

    const claims = await prisma.claim.findMany({
        where: {
            userId: +req.params.userId
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

    return res.status(200).json({ msg: claims })
}))

// GET /claim/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: +req.params.id
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

    return res.status(200).json({ msg: claim })
}))

// POST /claim/new
router.post('/new', auth, errForward(async (req, res) => {
    if (!claimSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "POLICY_HOLDER") {
        return res.status(400).json({
            err: 'Only policy holders can make claims'
        })
    }

    const policy = await prisma.policy.findUnique({
        where: {
            id: +req.body.policyId,
        },
        select: {
            userId: true
        }
    })

    if (policy.userId !== req.locals.userId) {
        return res.status(400).json({
            err: "Cannot make claim on other users policies"
        })
    }

    const claim = await prisma.claim.create({
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: new Date(req.body.dateOfIntimation).toISOString(),
            desc: req.body.desc,
            policyId: +req.body.policyId,
            userId: +req.locals.userId
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

    return res.status(200).json({
        msg: `Successfully created claim with id: ${claim.id}`
    })
}))

// PUT /claim/update/:id
router.put('/update/:id', auth, errForward(async (req, res) => {
    if (!updateClaimSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    const claim = await prisma.claim.findUnique({
        where: {
            id: +req.params.id
        },
        select: {
            userId: true
        }
    })

    if (!claim || req.locals.userId !== claim.userId) {
        return res.status(400).json({
            err: 'Could not update claim because it does not exist in your list of claims'
        })
    }

    const updatedClaim = await prisma.claim.update({
        where: {
            id: +req.params.id,
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

    if (!updatedClaim) {
        return res.status(500).json({
            err: 'Failed to update claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${updatedClaim.id} updated successfully`
    })
}))

// DELETE /claim/delete/:id
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: +req.params.id
        },
        select: {
            userId: true
        }
    })

    if (!claim || req.locals.userId !== claim.userId) {
        return res.status(400).json({
            err: 'Could not delete claim because it does not exist in your list of claims'
        })
    }

    const deletedClaim = await prisma.claim.delete({
        where: {
            id: +req.params.id,
        },
        select: {
            id: true
        }
    })

    if (!deletedClaim) {
        return res.status(500).json({
            err: 'Failed to delete claim'
        })
    }

    return res.status(200).json({
        msg: `Claim with id: ${deletedClaim.id} deleted successfully`
    })
}))

module.exports = router
