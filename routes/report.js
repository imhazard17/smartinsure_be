const router = require("express").Router;
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')
const generateReport = require('../utils/gemini')
const path = require('path')
const fs = require('fs')
const { getObjectUrl, downloadFile } = require('../utils/s3')

// GET /report/generate/:claimId   ==> use llms to generate report of claim and save the report to db
router.get('/generate/:claimId', errForward(async (req, res) => {
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

    const docs = prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            name: true
        }
    })

    const folderPath = path.join(__dirname, uuid())
    fs.mkdirSync(folderPath);
    await Promise.all(docs.map(async (doc) => {
        const url = await getObjectUrl(`documents/${doc.name}`)
        return downloadFile(url, path.join(folderPath, doc.name))
    }))

    const { docWiseReport, treatmentDetails, summary } = await generateReport(folderPath)
    fs.rmSync(folderPath, { recursive: true })

    let estimatedExpenses = 0
    JSON.parse(treatmentDetails).TreatmentDetails.forEach(ob => { estimatedExpenses += ob.Cost })

    const [newReport, _, __] = await prisma.$transaction([
        prisma.report.create({
            data: {
                combinedSummary: summary,
                estimatedExpenses,
                userId: claim.userId,
                claimId: req.params.claimId,
            },
            select: {
                id: true
            }
        }),
        prisma.alternateTreatments.create({
            data: {
                text: treatmentDetails,
                reportId: newReport.id
            }
        }),
        prisma.docWiseReport.create({
            data: {
                text: docWiseReport,
                reportId: newReport.id
            }
        })
    ])

    return res.status(200).json({
        msg: `Report created with id: ${newReport.id}`
    })
}))

// GET /report/:claimId
router.get('/:claimId', errForward(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: {
            claimId: req.params.claimId
        },
        include: {
            AlternateTreatments: true,
            DocWiseReport: true
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

    return res.status(200).json(report)
}))

// PUT /report/update/:claimId  ==> only for claim assessors
router.post('/update/:claimId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const updatedReport = await prisma.report.update({
        where: {
            claimId: req.locals.claimId
        },
        data: {
            combinedSummary: req.body.combinedSummary,
            estimatedExpenses: req.body.estimatedExpenses,
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
router.post('/treaments/update/:reportId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const updatedTreament = await prisma.alternateTreatments.update({
        where: {
            reportId: req.locals.reportId
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
        msg: `Report with id: ${updatedTreament.id} updated successfully`
    })
}))

// PUT /report/docWise/update/:reportId
router.post('/docWise/update/:reportId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const updatedDocwise = await prisma.report.update({
        where: {
            reportId: req.locals.reportId
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
        msg: `Report with id: ${updatedDocwise.id} updated successfully`
    })
}))

// DELETE /report/delete/:claimId
router.delete('/delete/:claimId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const deletedReport = await prisma.report.delete({
        where: {
            claimId: req.params.claimId
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
