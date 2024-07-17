const router = require("express").Router;
const errForward = require('../utils/errorForward')

// GET /document/upload/:claimId
router.get('/upload/:claimId', errForward(async (req, res) => {}))

// GET /document/:id
router.get('/:id', errForward(async (req, res) => {}))

// GET /document/:claimId   -> returns all the documents associated with a claim
router.get('/:claimId', errForward(async (req, res) => {}))

// POST /document/new/:policyId
router.post('/new', errForward(async (req, res) => {}))

// DELETE /document/delete/:id
router.delete('/delete/:id', errForward(async (req, res) => {}))

// DELETE /document/delete/:claimId   -> delete all docs associated wirh a claim
router.delete('/delete/:claimId', errForward(async (req, res) => {}))

module.exports = router
