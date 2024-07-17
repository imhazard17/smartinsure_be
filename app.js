const express = require('express')
const userRouter = require('./routes/user')
const authRouter = require('./routes/auth')
const claimRouter = require('./routes/claim')
const reportRouter = require('./routes/report')
const policyRouter = require('./routes/policy')
const documentRouter = require('./routes/document')
const error = require('./middlewares/error')

const app = express()

app.use(express.json())
app.use('/claim', claimRouter)
app.use('/report', reportRouter)
app.use('/policy', policyRouter)
app.use('/document', documentRouter)
app.use('/user', userRouter)
app.use('/auth', authRouter)

app.all('*', (req, res, next) => {
    return res.status(404).json({
        err: `Endpoint ${req.url} does not exist`
    })
})

app.use(error)

app.listen(3001, () => {
    console.log('Listening on port 3001')
})
