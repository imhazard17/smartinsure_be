const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require('dotenv').config()
const https = require('https');
const fs = require('fs');
const mime = require('mime-types')

const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
});

exports.getObjectUrl = async (key) => {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: 'inline'
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
    return url
}

exports.putObjectUrl = async (key) => {
    const fileName = key.split('/').at(-1)
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ContentType: mime.lookup(fileName)
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 2 * 60 });
    return url
}

exports.deleteObject = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command)
}

exports.downloadFile = (url, filePath) => {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            const file = fs.createWriteStream(filePath);
            response.pipe(file);
            file.on("finish", () => {
                file.close(resolve)
            }).on('error', err => {
                fs.unlink(filePath, () => reject(err));
            });
        });
    })
}
