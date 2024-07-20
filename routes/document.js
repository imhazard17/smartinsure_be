const router = require("express").Router;
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");
const upload = require('../middlewares/multer')
const archiver = require('archiver');

// GET /document/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const document = await prisma.document.findUnique({
        where: {
            id: req.params.id
        }
    })

    if (!document) {
        return res.status(400).json({
            err: 'No such document exists',
        })
    }

    if (document.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient privilages to access document',
        })
    }

    return res.status(200).sendFile(document.url)
}))

// GET /document/:claimId   -> returns all the documents associated with a claim
router.get('/:claimId', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.claimId
        },
        select: {
            userId: true
        }
    })

    if (claim.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        return res.status(400).json({
            err: 'Insufficient permission to access documents'
        })
    }

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=files.zip');

    archive.on('error', (err) => {
        return res.status(500).json({
            err: 'Could not send zipped docs'
        })
    });

    archive.pipe(res)

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        }
    })

    docs.forEach(doc => {
        archive.file(doc.path, { name: doc.originalname });
    })

    archive.finalize()
}))

// POST /document/upload/:claimId
router.post('/upload/:claimId', auth, upload.array('files', 15), errForward(async (req, res) => {
    const documentIds = []

    if (!req.files) {
        return req.status(500).json({
            err: 'File upload failed'
        })
    }

    try {
        Array.from(req.files).forEach(async (file) => {
            const docId = await prisma.document.create({
                data: {
                    docType: file.mimetype === 'application/pdf' ? 'TEXT' : 'SCAN',
                    name: file.originalname,
                    url: file.path,
                    claimId: req.params.claimId,
                    userId: req.locals.userId
                },
                select: {
                    id: true
                }
            })
            documentIds.push(docId)
        })
    } catch {
        return req.status(500).json({
            err: 'document creation failed'
        })
    }

    return req.status(200).json({
        msg: 'Documents created successfully',
        docIds: documentIds
    })
}))

// DELETE /document/delete/:id   (only for policy_holder)
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    const deletedDoc = await prisma.document.deleteMany({
        where: {
            claimId: req.params.claimId,
            userId: req.locals.userId
        },
        select: {
            id: true
        }
    })

    if (!deletedDoc) {
        return res.status(400).json({
            err: 'No such documents found'
        })
    }

    return res.status(200).json({
        msg: `Successfully deleted document with id: ${deletedDoc.id}`
    })
}))

// DELETE /document/delete/:claimId   -> delete all docs associated wirh a claim  (only for policy_holder)
router.delete('/delete/:claimId', auth, errForward(async (req, res) => {
    const deletedDocs = await prisma.document.deleteMany({
        where: {
            claimId: req.params.claimId,
            userId: req.locals.userId
        }
    })

    if (!deletedDocs) {
        return res.status(400).json({
            err: 'No such documents found'
        })
    }

    return res.status(200).json({
        msg: 'Successfully deleted documents'
    })
}))

module.exports = router
