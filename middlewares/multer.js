const multer = require('multer')
const { v6: uuid } = require('uuid')
const path = require('path')
const fs = require('fs')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.originalUrl.startsWith('/user')) {
            cb(null, folderPath);
        }
        if (req.originalUrl.startsWith('/document')) {
            const folderPath = path.join(__dirname, '..', 'uploads', 'document')
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }
            cb(null, folderPath);
        }
    },
    filename: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, req.params.claimId + '_' + uuid() + '.pdf')
        } else if (file.mimetype.startsWith('image/')) {
            cb(null, req.params.claimId + '_' + uuid() + '.jpg')
        }
    }
})

module.exports = multer({
    storage: storage,
    limits: {
        fileSize: 3145728
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Wrong filetype uploaded'))
        }
    },
})
