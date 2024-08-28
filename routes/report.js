const router = require("express").Router();
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')
const { generateReport, generateDocwise, generateSummary, generateTreatments } = require('../utils/gemini')
const path = require('path')
const fs = require('fs')
const { getObjectUrl, downloadFile } = require('../utils/s3')
const { v6: uuid } = require('uuid')
const auth = require('../middlewares/authentication');
const { z } = require("zod");
const convertibleToNum = require('../utils/zod_helper');

// GET /report/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: {
            id: +req.params.id
        },
        include: {
            alternateTreatments: true,
            docWiseReport: true
        }
    })

    if (!report) {
        return res.status(400).json({
            err: 'No such report found'
        })
    }

    if (report.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient privilages to access report'
        })
    }

    return res.status(200).json({ msg: report })
}))

// GET /report/claim/:claimId
router.get('/claim/:claimId', auth, errForward(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: {
            claimId: req.params.claimId
        },
        include: {
            alternateTreatments: true,
            docWiseReport: true
        }
    })

    if (!report) {
        return res.status(400).json({
            err: 'No such report found'
        })
    }

    if (report.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient privilages to access report'
        })
    }

    return res.status(200).json({ msg: report })
}))

// GET /report/generate/:claimId   ==> use llms to generate report of claim and save the report to db
router.get('/generate/:claimId', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const report = await prisma.report.findUnique({
        where: {
            claimId: req.params.claimId
        }
    })

    if (report) {
        await prisma.report.delete({
            where: {
                claimId: req.params.claimId
            }
        })
    }

    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.claimId
        },
        select: {
            userId: true
        }
    })

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            name: true,
            docType: true
        }
    })

    if (docs.length === 0) {
        return res.status(400).json({
            err: 'No documents uploaded for the claim yet'
        })
    }

    const docTypes = []
    const folderPath = path.join(__dirname, '..', uuid())
    fs.mkdirSync(folderPath);
    await Promise.all(docs.map(async (doc) => {
        docTypes.push(doc.docType)
        const url = await getObjectUrl(`medical_reports/${doc.name}`)
        return downloadFile(url, path.join(folderPath, doc.name))
    }))

    const { docWiseReport, treatmentDetails, summary } = await generateReport(folderPath, docTypes)
    fs.rmSync(folderPath, { recursive: true })

    const newReport = await prisma.report.create({
        data: {
            combinedSummary: summary,
            userId: claim.userId,
            claimId: req.params.claimId,
        },
        select: {
            id: true
        }
    })

    const [_, __] = await prisma.$transaction([
        prisma.alternateTreatments.create({
            data: {
                text: treatmentDetails,
                reportId: +(newReport.id)
            }
        }),
        prisma.docWiseReport.create({
            data: {
                text: docWiseReport,
                reportId: +(newReport.id)
            }
        })
    ])

    return res.status(200).json({ msg: newReport })
}))

// GET /report/summary/generate/:id
router.get('/summary/generate/:id', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const report = await prisma.report.findUnique({
        where: {
            id: +(req.params.id)
        },
        select: {
            claimId: true
        }
    })

    if (!report) {
        return res.status(400).json({
            err: 'No such report found'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: report.claimId
        },
        select: {
            name: true
        }
    })

    if (docs.length === 0) {
        return res.status(400).json({
            err: 'No documents uploaded for the claim yet'
        })
    }

    const folderPath = path.join(__dirname, '..', uuid())
    fs.mkdirSync(folderPath);
    await Promise.all(docs.map(async (doc) => {
        const url = await getObjectUrl(`medical_reports/${doc.name}`)
        return downloadFile(url, path.join(folderPath, doc.name))
    }))

    const summary = await generateSummary(folderPath)
    fs.rmSync(folderPath, { recursive: true })

    return res.status(200).json({ msg: summary })
}))

// GET /report/treatments/generate/:id
router.get('/treatments/generate/:id', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const report = await prisma.report.findUnique({
        where: {
            id: +(req.params.id)
        },
        select: {
            claimId: true
        }
    })

    if (!report) {
        return res.status(400).json({
            err: 'No such report found'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: report.claimId
        },
        select: {
            name: true
        }
    })

    if (docs.length === 0) {
        return res.status(400).json({
            err: 'No documents uploaded for the claim yet'
        })
    }

    const folderPath = path.join(__dirname, '..', uuid())
    fs.mkdirSync(folderPath);
    await Promise.all(docs.map(async (doc) => {
        const url = await getObjectUrl(`medical_reports/${doc.name}`)
        return downloadFile(url, path.join(folderPath, doc.name))
    }))

    const treatments = await generateTreatments(folderPath)
    fs.rmSync(folderPath, { recursive: true })

    return res.status(200).json({ msg: treatments })
}))

// GET /report/docwise/generate/:id
router.get('/docwise/generate/:id', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const report = await prisma.report.findUnique({
        where: {
            id: +(req.params.id)
        },
        select: {
            claimId: true
        }
    })

    if (!report) {
        return res.status(400).json({
            err: 'No such report found'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: report.claimId
        },
        select: {
            name: true,
            docType: true,
        }
    })

    if (docs.length === 0) {
        return res.status(400).json({
            err: 'No documents uploaded for the claim yet'
        })
    }

    const docTypes = []

    const folderPath = path.join(__dirname, '..', uuid())
    fs.mkdirSync(folderPath);
    await Promise.all(docs.map(async (doc) => {
        docTypes.push(doc.docType)
        const url = await getObjectUrl(`medical_reports/${doc.name}`)
        return downloadFile(url, path.join(folderPath, doc.name))
    }))

    const docwise = await generateDocwise(folderPath, docTypes)
    fs.rmSync(folderPath, { recursive: true })

    return res.status(200).json({ msg: docwise })
}))

// PUT /report/update/:id  ==> only for claim assessors
router.put('/update/:id', auth, errForward(async (req, res) => {
    const reportSchema = z.object({
        combinedSummary: z.string().optional(),
        notes: z.string().optional(),
        approved: z.literal("YES").or(z.literal("NO")).or(z.literal("STALL"))
    })

    if (!reportSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const updatedReport = await prisma.report.update({
        where: {
            id: +(req.params.id)
        },
        data: {
            combinedSummary: req.body.combinedSummary,
            notes: req.body.notes,
            approved: req.body.approved,
        },
        select: {
            id: true
        }
    })

    if (!updatedReport) {
        return res.status(400).json({
            err: 'No such report exists'
        })
    }

    return res.status(200).json({
        msg: `Report with id: ${updatedReport.id} updated successfully`
    })
}))

// PUT /report/treaments/update/:reportId
router.put('/treaments/update/:reportId', auth, errForward(async (req, res) => {
    const treamentSchema = z.object({
        text: z.string()
    })

    if (!treamentSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const updatedTreament = await prisma.alternateTreatments.update({
        where: {
            reportId: +(req.params.reportId)
        },
        data: {
            text: req.body.text,
        },
        select: {
            id: true
        }
    })

    if (!updatedTreament) {
        return res.status(400).json({
            err: 'No such report exists'
        })
    }

    return res.status(200).json({
        msg: `Alternate treatments of report with id: ${updatedTreament.id} updated successfully`
    })
}))

// PUT /report/docWise/update/:reportId
router.put('/docWise/update/:reportId', auth, errForward(async (req, res) => {
    const docWiseSchema = z.object({
        text: z.string()
    })

    if (!docWiseSchema.safeParse(req.body).success) {
        return res.status(400).json({
            err: 'Invalid inputs given'
        })
    }

    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const updatedDocwise = await prisma.docWiseReport.update({
        where: {
            reportId: +(req.params.reportId),
        },
        data: {
            text: req.body.text,
        },
        select: {
            id: true
        }
    })

    if (!updatedDocwise) {
        return res.status(400).json({
            err: 'No such report exists'
        })
    }

    return res.status(200).json({
        msg: `Document wise reports of report with id: ${updatedDocwise.id} updated successfully`
    })
}))

// DELETE /report/delete/:reportId
router.delete('/delete/:reportId', auth, errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: "Insufficient privilages to make this action"
        })
    }

    const deletedReport = await prisma.report.delete({
        where: {
            id: +req.params.reportId
        },
        select: {
            id: true
        }
    })

    if (!deletedReport) {
        return res.status(400).json({
            err: 'No such report exists'
        })
    }

    return res.status(200).json({
        msg: `Report with id: ${deletedReport.id} deleted successfully`
    })
}))

module.exports = router
