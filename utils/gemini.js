const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs")
require('dotenv').config()
const mime = require('mime-types');
const path = require("path");

const removeNewlines = (str) => {
    return str.replace(/\n/g, '');
};

const prompts = {
    "image": `Please provide type of report uploaded, technique, diagnosis details, findings, clinical indication and
    impression for this medical report also provide medical report name for each of the files. Reply with only one JSON per one uploaded file and do not wrap JSON with \`\`json\`\`. Return a LIST OF JSON with format of each JSON element given below:
    {"Findings":"Findings of type Text","ClinicalIndication":"Clinical Indication of type Text","TypeOfReportUploaded":"Type Of Report Uploaded of type Text","MedicalReportName":"Unique medical Report Name of type Text","Diagnosis":"Diagnosis of type Text", "Impression":"Impression of type Text","Technique":"Technique of type Text"}`,

    "pdf": `Please provide medical report name and provide prognosis details for each of the files. Reply with only one JSON per one uploaded file and do not wrap JSON with \`\`json\`\`. Return A LIST OF JSON with format of each JSON element given below:
    {"Prognosis":"Prognosis of type Text","MedicalReportName":"Unique medical Report Name of type Text"}`,

    "treatment": `Please provide a list of different treatment details with brief description and associated cost for all pdf and image files uploaded in the previous prompts in rupees and if its a range then return the LOWEST cost in rupees. Reply with only one JSON in and do not wrap JSON with \`\`json\`\`. The JSON format specified below:
    {"TreatmentDetails":[{"TreatmentDescription":"Treatment Description of type Text","TypeOfTreatment":"TypeOfTreatment of type Text","Cost":"Cost of type Number in rupees"}]}`,

    "summary": `Please provide a clinical summary for all pdf and image files in previous prompts. Reply with only one JSON in and do not wrap JSON with \`\`json\`\` also do not provide any new line charecter. The JSON format specified below:
    {"Summary":"Summary of type Text"}`
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}

exports.generateReport = async (folderPath, docTypes) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat()

    const fileParts = []
    const files = fs.readdirSync(folderPath)
    files.forEach(file => fileParts.push(fileToGenerativePart(path.join(folderPath, file), mime.lookup(file))))

    const [textFileParts, scanFileParts] = [[], []]
    fileParts.forEach((filePart, i) => {
        if (docTypes[i] === "SCAN") {
            scanFileParts.push(filePart)
        } else if (docTypes[i] === "TEXT") {
            textFileParts.push(filePart)
        }
    })
    let [imgDWresp, txtDWresp] = [[], []]

    if (scanFileParts.length !== 0) {
        let result = await chat.sendMessage([prompts['image'], scanFileParts]);
        let response = result.response;
        imgDWresp = JSON.parse(response.text())
    }

    if (textFileParts.length !== 0) {
        result = await chat.sendMessage([prompts['pdf'], textFileParts]);
        response = result.response;
        txtDWresp = JSON.parse(response.text())
    }

    let docWiseReport = JSON.stringify([...imgDWresp, ...txtDWresp])

    result = await chat.sendMessage([prompts['treatment'], ...fileParts]);
    response = result.response;
    const treatmentDetails = removeNewlines(response.text());

    result = await chat.sendMessage([prompts['summary'], ...fileParts]);
    response = result.response;
    const summary = removeNewlines(response.text());

    return {
        docWiseReport,
        treatmentDetails,
        summary
    }
}

exports.generateSummary = async (folderPath) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fileParts = []
    const files = fs.readdirSync(folderPath)
    files.forEach(file => fileParts.push(fileToGenerativePart(path.join(folderPath, file), mime.lookup(file))))

    result = await model.generateContent([prompts['summary'], ...fileParts]);
    response = result.response;
    const summary = removeNewlines(response.text());

    return summary
}

exports.generateTreatments = async (folderPath) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fileParts = []
    const files = fs.readdirSync(folderPath)
    files.forEach(file => fileParts.push(fileToGenerativePart(path.join(folderPath, file), mime.lookup(file))))

    let result = await model.generateContent([prompts['treatment'], ...fileParts]);
    response = result.response;
    const treatmentDetails = removeNewlines(response.text());

    return treatmentDetails
}

exports.generateDocwise = async (folderPath, docTypes) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fileParts = []
    const files = fs.readdirSync(folderPath)
    files.forEach(file => fileParts.push(fileToGenerativePart(path.join(folderPath, file), mime.lookup(file))))

    const [textFileParts, scanFileParts] = [[], []]
    fileParts.forEach((filePart, i) => {
        if (docTypes[i] === "SCAN") {
            scanFileParts.push(filePart)
        } else if (docTypes[i] === "TEXT") {
            textFileParts.push(filePart)
        }
    })
    let [imgDWresp, txtDWresp] = [[], []]

    if (scanFileParts.length !== 0) {
        let result = await model.generateContent([prompts['image'], scanFileParts]);
        let response = result.response;
        imgDWresp = JSON.parse(response.text())
    }

    if (textFileParts.length !== 0) {
        result = await model.generateContent([prompts['pdf'], textFileParts]);
        response = result.response;
        txtDWresp = JSON.parse(response.text())
    }

    let docWiseReport = JSON.stringify([...imgDWresp, ...txtDWresp])

    return docWiseReport
}
