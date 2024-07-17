const router = require("express").Router;
const errForward = require('../utils/errorForward')

// GET /claim/my-claim/:id
router.get('/my-claims', errForward(async (req, res) => {}))

// GET /claim/:id
router.get('/:id', errForward(async (req, res) => {}))

// POST /claim/new/:policyId
router.post('/new', errForward(async (req, res) => {}))

// PUT /claim/update/:id
router.put('/update/:id', errForward(async (req, res) => {}))

// DELETE /claim/delete/:id
router.delete('/delete/:id', errForward(async (req, res) => {}))

module.exports = router
