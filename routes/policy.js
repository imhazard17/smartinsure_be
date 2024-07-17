const router = require("express").Router;
const errForward = require('../utils/errorForward')

// policy can be written only by claim assessor and read by both policy holder and claim assessor

// GET /policy/:id
router.get('/:id', errForward(async (req, res) => {}))

// POST /policy/new
router.post('/new', errForward(async (req, res) => {}))

// PUT /policy/update/:id
router.put('/update/:id', errForward(async (req, res) => {}))

// DELETE /policy/delete/:id
router.delete('/delete/:id', errForward(async (req, res) => {}))

module.exports = router
