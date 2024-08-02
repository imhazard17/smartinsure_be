const router = require("express").Router();
const errForward = require('../utils/errorForward')
const auth = require('../middlewares/authentication');
const prisma = require("../utils/db");
const upload = require('../middlewares/multer')
const { putObjectUrl, getObjectUrl, deleteObject } = require("../utils/s3");
const { default: axios } = require("axios");
const fs = require("fs");
const { z } = require("zod");

// GET /document/:id
router.get('/:id', auth, errForward(async (req, res) => {
    const document = await prisma.document.findUnique({
        where: {
            id: parseInt(req.params.id)
        }
    })

    if (!document) {
        return res.status(400).json({
            err: 'No such document exists',
        })
    }

    if (document.userId !== req.locals.userId && req.locals.role !== "CLAIM_ASSESSOR") {
        console.log(req.locals)
        return res.status(400).json({
            err: 'Insufficient privilages to access document',
        })
    }

    const url = await getObjectUrl(`documents/${document.name}`)
    return res.status(200).json({ url: url, ...document })
}))

// GET /document/count/:claimId
router.get('/count/:claimId', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.claimId)
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
            claimId: parseInt(req.params.claimId)
        },
        select: {
            id: true
        }
    })

    return res.status(200).json({
        docCount: docs.length
    })
}))

// GET /document/claim/:claimId   -> returns all the documents associated with a claim
router.get('/claim/:claimId', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.claimId)
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
            claimId: parseInt(req.params.claimId)
        }
    })

    const urls = await Promise.all(docs.map(doc => getObjectUrl(`documents/${doc.name}`)))

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
    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.claimId)
        },
        select: {
            userId: true
        }
    })

    if (claim.userId !== req.locals.userId) {
        return res.status(400).json({
            err: 'Cannot upload document on the claims you dont own'
        })
    }

    const documentIds = []
    const files = Array.from(req.files)

    if (!req.files) {
        return res.status(500).json({
            err: 'File upload failed'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: parseInt(req.params.claimId)
        },
        select: {
            id: true
        }
    })

    if (docs.length + files.length >= 15) {
        await Promise.all(files.map(file => new Promise((resolve, reject) => {
            fs.unlink(file.path, err => err ? reject() : resolve())
        })))
        return res.status(400).json({
            err: 'Cannot have more than 15 documents per claim'
        })
    }

    const uploads = files.map((file) => {
        return new Promise(async (resolve, _) => {
            const createdDoc = await prisma.document.create({
                data: {
                    docType: file.mimetype === 'application/pdf' ? 'TEXT' : 'SCAN',
                    name: file.filename,
                    claimId: parseInt(req.params.claimId),
                    userId: parseInt(req.locals.userId),
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
                        id: parseInt(createdDoc.id)
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

    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.claimId)
        },
        select: {
            userId: true
        }
    })

    if (claim.userId !== req.locals.userId) {
        return res.status(400).json({
            err: 'Cannot upload document on the claims you dont own'
        })
    }

    if (!file) {
        return res.status(500).json({
            err: 'File upload failed'
        })
    }

    const docs = await prisma.document.findMany({
        where: {
            claimId: parseInt(req.params.claimId)
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
                claimId: parseInt(req.params.claimId),
                userId: parseInt(req.locals.userId),
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
                    id: parseInt(createdDoc.id)
                }
            })
        }
        fs.unlinkSync(file.path)
        return res.status(200).json({
            msg: 'Document created successfully',
            docIds: createdDoc.id
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            err: 'document creation failed'
        })
    }
}))

// DELETE /document/delete/:id   (only for policy_holder)
router.delete('/delete/:id', auth, errForward(async (req, res) => {
    const document = await prisma.document.findUnique({
        where: {
            id: parseInt(req.params.id)
        },
        select: {
            id: true,
            userId: true,
            name: true
        }
    })

    if(!document) {
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
            id: parseInt(req.params.id),
        }
    })

    await deleteObject(`documents/${document.name}`)

    return res.status(200).json({
        msg: `Successfully deleted document with id: ${document.id}`
    })
}))

// DELETE /document/delete/claim/:claimId   -> delete all docs associated wirh a claim  (only for policy_holder)
router.delete('/delete/claim/:claimId', auth, errForward(async (req, res) => {
    const claim = await prisma.claim.findUnique({
        where: {
            id: parseInt(req.params.claimId)
        },
        select: {
            userId: true
        }
    })

    if(!claim) {
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
            claimId: parseInt(req.params.claimId),
        },
        select: {
            name: true
        }
    })

    await prisma.document.deleteMany({
        where: {
            claimId: parseInt(req.params.claimId),
        }
    })

    await Promise.all(docs.map(doc => deleteObject(`documents/${doc.name}`)))

    return res.status(200).json({
        msg: `Successfully deleted documents which belonged to claim with id: ${req.params.claimId}`
    })
}))

module.exports = router
