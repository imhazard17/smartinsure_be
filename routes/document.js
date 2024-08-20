const router = require("express").Router();
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");
const upload = require('../middlewares/multer')
const { putObjectUrl, getObjectUrl, deleteObject } = require("../utils/s3");
const { default: axios } = require("axios");
const fs = require("fs");
const mime = require('mime-types')

async function removeAllUploadedFiles(files) {
    await Promise.all(files.map(file => new Promise((resolve, reject) => {
        fs.unlink(file.path, err => err ? reject() : resolve())
    })))
}

// GET /document/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const document = await prisma.document.findUnique({
        where: {
            id: +(req.params.id)
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

    const url = await getObjectUrl(`medical_reports/${document.name}`)
    return res.status(200).json({
        msg: { url: url, ...document }
    })
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

    if(!claim) {
        return res.status(400).json({
            err: 'No such claim found'
        })
    }

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
        msg: docs.length
    })
}))

// GET /document/claim/:claimId   -> returns all the documents associated with a claim
router.get('/claim/:claimId', auth, errForward(async (req, res) => {
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
        }
    })

    const urls = await Promise.all(docs.map(doc => getObjectUrl(`medical_reports/${doc.name}`)))

    const resp = urls.map((url, i) => {
        return {
            ...docs[i],
            url: url
        }
    })

    return res.status(200).json({
        msg: resp
    })
}))

// POST /document/upload/:claimId
router.post('/upload/:claimId', auth, upload.array('files', 15), errForward(async (req, res) => {
    if (!req.files) {
        return res.status(500).json({
            err: 'File upload failed'
        })
    }

    const documentIds = []
    const files = Array.from(req.files)

    const fileTypes = req.body.fileTypes.split(',')

    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.claimId
        },
        select: {
            userId: true
        }
    })

    if (claim.userId !== req.locals.userId) {
        removeAllUploadedFiles(files)
        return res.status(400).json({
            err: 'Cannot upload document on the claims you dont own'
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

    if (docs.length + files.length > 15) {
        removeAllUploadedFiles(files)
        return res.status(400).json({
            err: 'Cannot have more than 15 documents per claim'
        })
    }

    const uploads = files.map((file, i) => {
        return new Promise(async (resolve, _) => {
            const createdDoc = await prisma.document.create({
                data: {
                    docType: fileTypes[i],
                    name: file.filename,
                    claimId: req.params.claimId,
                    userId: +(req.locals.userId),
                    originalName: file.originalname
                },
                select: {
                    id: true
                }
            })
            documentIds.push(createdDoc.id)
            const url = await putObjectUrl(`medical_reports/${file.filename}`)
            const fileStream = fs.createReadStream(file.path)
            const fileSize = fs.statSync(file.path).size
            const s3Upload = await axios.put(url, fileStream, {
                headers: {
                    'Content-Type': mime.lookup(file.filename),
                    'Content-Length': fileSize,
                }
            })
            if (s3Upload.status !== 200) {
                prisma.document.delete({
                    where: {
                        id: +(createdDoc.id)
                    }
                })
            }
            fs.unlinkSync(file.path)
            resolve()
        })
    })
    try {
        await Promise.all(uploads)
        return res.status(200).json({
            msg: 'Documents created successfully',
            docIds: documentIds
        })
    } catch {
        return res.status(500).json({
            err: 'document creation failed'
        })
    }
}))

// POST /document/upload/one/:claimId
router.post('/upload/one/:claimId', auth, upload.single('file'), errForward(async (req, res) => {
    const file = req.file
    if (!file) {
        return res.status(500).json({
            err: 'Document upload failed'
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

    if (claim.userId !== req.locals.userId) {
        fs.unlinkSync(file.path)
        return res.status(400).json({
            err: 'Cannot upload document on the claims you dont own'
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
        fs.unlinkSync(file.path)
        return res.status(400).json({
            err: 'Cannot have more than 15 documents per claim'
        })
    }

    try {
        const createdDoc = await prisma.document.create({
            data: {
                docType: file.mimetype === 'application/pdf' ? 'TEXT' : 'SCAN',
                name: file.filename,
                claimId: req.params.claimId,
                userId: +(req.locals.userId),
                originalName: file.originalname
            },
            select: {
                id: true
            }
        })
        const url = await putObjectUrl(`medical_reports/${file.filename}`)
        const fileStream = fs.createReadStream(file.path)
        const fileSize = fs.statSync(file.path).size
        const s3Upload = await axios.put(url, fileStream, {
            headers: {
                'Content-Type': mime.lookup(file.filename),
                'Content-Length': fileSize,
            }
        })
        if (s3Upload.status !== 200) {
            prisma.document.delete({
                where: {
                    id: +(createdDoc.id)
                }
            })
        }
        fs.unlinkSync(file.path)
        return res.status(200).json({
            msg: `Document with id: ${createdDoc.id} created successfully`,
        })
    } catch (err) {
        return res.status(500).json({
            err: 'document creation failed'
        })
    }
}))

// DELETE /document/delete/:id   (only for policy_holder)
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    const document = await prisma.document.findUnique({
        where: {
            id: +(req.params.id)
        },
        select: {
            id: true,
            userId: true,
            name: true
        }
    })

    if (!document) {
        return res.status(400).json({
            err: 'Document does not exist'
        })
    }

    if (document.userId !== req.locals.userId) {
        return res.status(400).json({
            err: 'Cannot delete document which you dont own'
        })
    }

    await prisma.document.delete({
        where: {
            id: +(req.params.id),
        }
    })

    await deleteObject(`medical_reports/${document.name}`)

    return res.status(200).json({
        msg: `Successfully deleted document with id: ${document.id}`
    })
}))

// DELETE /document/delete/claim/:claimId   -> delete all docs associated wirh a claim  (only for policy_holder)
router.delete('/delete/claim/:claimId', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: req.params.claimId
        },
        select: {
            userId: true
        }
    })

    if (!claim) {
        return res.status(400).json({
            err: 'Such claim does not exist'
        })
    }

    if (claim.userId !== req.locals.userId) {
        return res.status(400).json({
            err: 'Cannot delete document which you dont own'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: req.params.claimId,
        },
        select: {
            name: true
        }
    })

    const deleteDocs = await prisma.document.deleteMany({
        where: {
            claimId: req.params.claimId,
        }
    })

    await Promise.all(docs.map(doc => deleteObject(`medical_reports/${doc.name}`)))

    return res.status(200).json({
        msg: `Number of deleted documents: ${deleteDocs.count}`
    })
}))

module.exports = router
