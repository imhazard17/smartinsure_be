const multer = require('multer')
const crypto = require('crypto')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.originalUrl.startsWith('/user')) {
            cb(null, '../uploads/user');
        }
        if (req.originalUrl.startsWith('/document')) {
            cb(null, '../uploads/document');
        }
    },
    filename: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, 'text' + crypto.randomBytes(15).toString('hex') + '.pdf')
        } else if (file.mimetype.startsWith('image/')) {
            cb(null, 'scan' + crypto.randomBytes(15).toString('hex') + '.jpg')
        }
    }
})

module.exports = multer({
    storage: storage,
    limits: {
        fileSize: 3 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype in ['image/jpeg', 'image/png', 'application/pdf']) {
            cb(null, true)
        } else {
            cb(new Error('Wrong filetype uploaded'))
        }
    },
})
