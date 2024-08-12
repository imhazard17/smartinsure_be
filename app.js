const express = require('express')
const userRouter = require('./routes/user')
const authRouter = require('./routes/auth')
const claimRouter = require('./routes/claim')
const reportRouter = require('./routes/report')
const policyRouter = require('./routes/policy')
const documentRouter = require('./routes/document')
const error = require('./middlewares/error')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/claim', claimRouter)
app.use('/report', reportRouter)
app.use('/policy', policyRouter)
app.use('/document', documentRouter)
app.use('/user', userRouter)
app.use('/auth', authRouter)

app.all('*', (req, res, next) => {
    return res.status(404).json({
        err: `Endpoint ${req.method} ${req.url} does not exist`
    })
})

app.use(error)

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Listening on port: ${process.env.SERVER_PORT}`)
})
