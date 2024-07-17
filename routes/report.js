const router = require("express").Router;

// GET /report/generate/:claimId   ==> use llms to generate report of claim
router.get('/generate/:claimId', errForward(async (req, res) => {}))

// GET /report/:claimId
router.get('/:claimId', errForward(async (req, res) => {}))

// POST /report/add/:claimId
router.post('/add/:claimId', errForward(async (req, res) => {}))

// DELETE /report/delete/:claimId
router.delete('/delete/:claimId', errForward(async (req, res) => {}))

module.exports = router
