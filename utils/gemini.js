const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs")
require('dotenv').config()
const mime = require('mime-types');
const path = require("path");

const prompts = {
    "image": `Please provide type of report uploaded, technique, diagnosis details, findings, clinical indication and
    impression for this medical report also also provide medical report name for each of the files which are images only. Reply with only JSON in the JSON format specified below: {"Findings":"Findings of type
    Text","ClinicalIndication":"Clinical Indication of type Text","TypeOfReportUploaded":"Type Of Report
    Uploaded of type Text","MedicalReportName":"Medical Report Name of type
    Text","Diagnosis":"Diagnosis of type Text","Impression":"Impression of type
    Text","Technique":"Technique of type Text"}`,

    "pdf": `Please provide medical report name and provide prognosis details for each of the files which are pdfs only. Reply with only JSON in the JSON format specified below: {"Prognosis":"Prognosis of type
    Text","MedicalReportName":"Medical Report Name of type Text"}`,

    "treatment": `Please provide different treatment details with brief description and associated cost for all pdf and image files uploaded in the previous prompts in dollars and if its a range then return the average cost Reply
    with only JSON in the JSON format specified below:
    {"TreatmentDetails":[{"TreatmentDescription":"Treatment Description of type
    Text","TypeOfTreatment":"TypeOfTreatment of type Text","Cost":"Cost of type Number"}]}`,

    "summary": `Please provide a clinical summary for all pdf and image files in previous prompts. Reply with only JSON in the JSON format
    specified below: {"Summary":"Summary of type Text"}`
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

async function generateReport(folderPath) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat()

    const fileParts = []
    const files = fs.readdirSync(folderPath)
    files.forEach(file => fileParts.push(fileToGenerativePart(path.join(folderPath, file), mime.lookup(file))))

    let result = await chat.sendMessage([prompts['image'], ...fileParts.filter(part => part.inlineData.mimeType.startsWith('image'))]);
    let response = result.response;
    let docWiseReport = response.text();

    result = await chat.sendMessage([prompts['pdf'], ...fileParts.filter(part => part.inlineData.mimeType.endsWith('pdf'))]);
    response = result.response;
    docWiseReport += response.text()
    docWiseReport = docWiseReport.slice(8, docWiseReport.length - 4).split('\n```\n```json\n')

    result = await chat.sendMessage([prompts['treatment'], ...fileParts]);
    response = result.response;
    let treatmentDetails = response.text();
    treatmentDetails = treatmentDetails.split('\n')[1]

    result = await chat.sendMessage([prompts['summary'], ...fileParts]);
    response = result.response;
    let summary = response.text();
    summary = summary.split('\n')[1]

    return {
        docWiseReport,
        treatmentDetails,
        summary
    }
}

module.exports = generateReport
