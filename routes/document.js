const router = require("express").Router;
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");
const upload = require('../middlewares/multer')
const { putObjectUrl, getObjectUrl, deleteObject } = require("../utils/s3");
const { default: axios } = require("axios");
const fs = require("fs");

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

    const s3Url = await getObjectUrl(`documents/${document.name}`)
    return res.status(200).json({ url: s3Url })
}))

// GET /document/count/:claimId
router.get('/count/:claimId', auth, errForward(async (req, res) => {
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

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            id: true
        }
    })

    return res.status(200).json({
        docCount: docs.length
    })
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

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            originalName: true
        }
    })

    const resp = []

    docs.forEach(async (doc) => {
        const url = await getObjectUrl(`documents/${doc.name}`)
        resp.push({
            name: doc.originalName,
            url: url
        })
    })

    return res.status(200).json({
        msg: resp
    })
}))

// POST /document/upload/:claimId
router.post('/upload/:claimId', auth, upload.array('files', 15), errForward(async (req, res) => {
    const documentIds = []
    const files = Array.from(req.files)

    if (!req.files) {
        return req.status(500).json({
            err: 'File upload failed'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            id: true
        }
    })

    if (docs.length + files.length >= 15) {
        await Promise.all(files.map(file => new Promise((resolve, reject) => {
            fs.unlink(file.path, err => err ? reject() : resolve())
        })))
        return req.status(400).json({
            err: 'Cannot have more than 15 documents per claim'
        })
    }

    const uploads = files.map((file) => {
        return new Promise(async (resolve, _) => {
            const createdDoc = await prisma.document.create({
                data: {
                    docType: file.mimetype === 'application/pdf' ? 'TEXT' : 'SCAN',
                    name: file.filename,
                    claimId: req.params.claimId,
                    userId: req.locals.userId,
                    originalName: file.originalname
                },
                select: {
                    id: true
                }
            })
            documentIds.push(createdDoc.id)
            const url = await putObjectUrl(file.mimetype, `documents/${file.filename}`)
            const fileStream = fs.createReadStream(file.path)
            const fileSize = fs.statSync(file.path).size
            const s3Upload = await axios.put(url, fileStream, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileSize,
                }
            })
            if (s3Upload.status !== 200) {
                prisma.document.delete({
                    where: {
                        id: createdDoc.id
                    }
                })
            }
            fs.unlinkSync(file.path)
            resolve()
        })
    })
    try {
        await Promise.all(uploads)
        return req.status(200).json({
            msg: 'Documents created successfully',
            docIds: documentIds
        })
    } catch {
        return req.status(500).json({
            err: 'document creation failed'
        })
    }
}))

// POST /document/upload/one/:claimId
router.post('/upload/:claimId', auth, upload.single('file'), errForward(async (req, res) => {
    if (!req.file) {
        return req.status(500).json({
            err: 'File upload failed'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId
        },
        select: {
            id: true
        }
    })

    if (docs.length === 15) {
        fs.unlinkSync(req.file.path)
        return req.status(400).json({
            err: 'Cannot have more than 15 documents per claim'
        })
    }

    try {
        const createdDoc = await prisma.document.create({
            data: {
                docType: file.mimetype === 'application/pdf' ? 'TEXT' : 'SCAN',
                name: file.filename,
                claimId: req.params.claimId,
                userId: req.locals.userId,
                originalName: file.originalname
            },
            select: {
                id: true
            }
        })
        const url = await putObjectUrl(file.mimetype, `documents/${file.filename}`)
        const fileStream = fs.createReadStream(file.path)
        const fileSize = fs.statSync(file.path).size
        const s3Upload = await axios.put(url, fileStream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize,
            }
        })
        if (s3Upload.status !== 200) {
            prisma.document.delete({
                where: {
                    id: createdDoc.id
                }
            })
        }
        fs.unlinkSync(file.path)
        return req.status(200).json({
            msg: 'Documents created successfully',
            docIds: documentIds
        })
    } catch {
        return req.status(500).json({
            err: 'document creation failed'
        })
    }
}))

// DELETE /document/delete/:id   (only for policy_holder)
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    const deletedDoc = await prisma.document.deleteMany({
        where: {
            claimId: req.params.claimId,
            userId: req.locals.userId
        },
        select: {
            id: true,
            name: true,
        }
    })

    if (!deletedDoc) {
        return res.status(400).json({
            err: 'No such documents found'
        })
    }

    await deleteObject(`documents/${deletedDoc.name}`)

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
        },
        select: {
            name: true
        }
    })

    if (!deletedDocs) {
        return res.status(400).json({
            err: 'No such documents found'
        })
    }

    await Promise.all(deletedDocs.map(deletedDoc => deleteObject(`documents/${deletedDoc.name}`)))

    return res.status(200).json({
        msg: `Successfully deleted documents which belonged to claim with id: ${req.params.claimId}`
    })
}))

module.exports = router
