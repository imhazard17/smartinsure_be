const multer = require('multer')
const { v6: uuid } = require('uuid')

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
            cb(null, 'text' + uuid() + '.pdf')
        } else if (file.mimetype.startsWith('image/')) {
            cb(null, 'scan' + uuid() + '.jpg')
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
