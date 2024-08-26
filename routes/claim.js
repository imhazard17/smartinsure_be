const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middlewares/authentication");
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')
const convertibleToNum = require('../utils/zod_helper')
const dayjs = require('dayjs')
const { v6: uuid } = require('uuid');
const { getObjectUrl } = require("../utils/s3");

const claimSchema = z.object({
    claimAmount: z.number(),
    claimType: z.string(),
    dateOfIntimation: z.string().date(),
    dateOfAdmission: z.string().date(),
    desc: z.string().optional(),
    policyId: z.string(),
    title: z.string().min(5).max(150)
})

const updateClaimSchema = z.object({
    claimAmount: z.number(),
    claimType: z.string(),
    dateOfIntimation: z.string().date(),
    dateOfAdmission: z.string().date(),
    desc: z.string().optional(),
    title: z.string().min(5).max(150)
})

// GET /claim/my-claims
router.get('/my-claims', auth, errForward(async (req, res) => {
    const claims = await prisma.claim.findMany({
        where: {
            userId: +req.locals.userId
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true
                }
            },
        }
    })

    if (!claims) {
        return res.status(400).json({
            err: 'No claims yet'
        })
    }

    return res.status(200).json({ msg: claims })
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
            user: {
                select: {
                    firstName: true,
                    lastName: true
                }
            },
        }
    })

    if (!claims) {
        return res.status(400).json({
            err: 'No such claims found'
        })
    }

    return res.status(200).json({ msg: claims })
}))

// GET /claim/pending
router.get('/pending', auth, errForward(async (req, res) => {
    const { claimsPerPage = 20, pageNumber = 1 } = req.query
    if (isNaN(Number(claimsPerPage + pageNumber)) || claimsPerPage < 0 || pageNumber < 0 || claimsPerPage > 100) {
        return res.status(400).json({
            err: 'Maximum 100 claims per page'
        })
    }

    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insuffient privilages'
        })
    }

    const claims = await prisma.claim.findMany({
        where: {
            OR: [
                {
                    report: {
                        approved: 'STALL',
                    }
                },
                {
                    report: null
                }
            ]
        },
        orderBy: {
            createdAt: 'asc'
        },
        skip: (pageNumber - 1) * claimsPerPage,
        take: claimsPerPage,
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true
                }
            }
        }
    })

    if (!claims) {
        return res.status(400).json({
            err: 'Error fetching claims'
        })
    }

    return res.status(200).json({ msg: claims })
}))

// GET /claim/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.id
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

    const urls = await Promise.all(Array.from(claim.documents).map(doc => getObjectUrl(`medical_reports/${doc.name}`)))
    Array.from(claim.documents).forEach((doc, i) => doc.url = urls[i])

    return res.status(200).json({ msg: claim })
}))

// POST /claim/new
router.post('/new', auth, errForward(async (req, res) => {
    try {
        claimSchema.parse(req.body);
    } catch (error) {
        let errors = ''
        error.issues.forEach((issue) => errors += `${issue.path.join('.')} - ${issue.message}\n`);
        return res.status(400).json({
            err: `Invalid inputs given.\n${errors}`
        })
    }

    if (req.locals.role !== "POLICY_HOLDER") {
        return res.status(400).json({
            err: 'Only policy holders can make claims'
        })
    }

    const policy = await prisma.policy.findUnique({
        where: {
            id: req.body.policyId,
        },
        select: {
            emails: true,
            id: true,
        }
    })
    const loggedUser = await prisma.user.findUnique({
        where: {
            id: req.locals.userId
        },
        select: {
            email: true
        }
    })

    if (!loggedUser) res.status(400).json({ err: 'Error getting user' })

    if (!Array.from(policy.emails).includes(loggedUser.email)) {
        return res.status(400).json({
            err: "Cannot make claim on other users policies"
        })
    }

    const createdClaim = await prisma.claim.create({
        data: {
            id: `SI${dayjs().format('YYYYMMDD')}-${uuid().split('-')[0]}-C`,
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: new Date(req.body.dateOfIntimation).toISOString(),
            desc: req.body.desc,
            title: req.body.title,
            policyId: req.body.policyId,
            userId: +req.locals.userId,
            hospCity: req.body.hospCity,
            hospCode: req.body.hospCode,
            hospName: req.body.hospName,
            dateOfAdmission: new Date(req.body.dateOfAdmission).toISOString()
        },
        select: {
            id: true
        }
    })

    return res.status(200).json({
        msg: `Successfully created claim with id: ${createdClaim.id}`
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
            id: req.params.id
        },
        select: {
            userId: true,
            id: true
        }
    })

    if (!claim || req.locals.userId !== claim.userId) {
        return res.status(400).json({
            err: 'Could not update claim because it does not exist in your list of claims'
        })
    }

    const updatedClaim = await prisma.claim.update({
        where: {
            id: claim.id,
        },
        data: {
            claimAmount: req.body.claimAmount,
            claimType: req.body.claimType,
            dateOfIntimation: new Date(req.body.dateOfIntimation).toISOString(),
            desc: req.body.desc,
            title: req.body.title,
            hospName: req.body.hospName,
            hospCity: req.body.hospCity,
            hospCode: req.body.hospCode,
            dateOfAdmission: new Date(req.body.dateOfAdmission).toISOString(),
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
            id: req.params.id
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
            id: req.params.id,
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
