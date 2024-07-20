const router = require("express").Router;
const prisma = require("../utils/db");
const errForward = require('../utils/errorForward')

// GET /report/generate/:claimId   ==> use llms to generate report of claim and save the report to db
router.get('/generate/:claimId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }
}))

// GET /report/:claimId
router.get('/:claimId', errForward(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: {
            claimId: req.params.claimId
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
            documentWiseSummary: req.body.documentWiseSummary,
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

// DELETE /report/delete/:claimId
router.delete('/delete/:claimId', errForward(async (req, res) => {
    if (req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            msg: "Insufficient privilages to make this action"
        })
    }

    const deletedReport = await prisma.report.delete({
        where: {
            claimId: req.locals.claimId
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
