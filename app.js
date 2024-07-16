const express = require('express')
const userRouter = require('./routes/user')
const authRouter = require('./routes/auth')
const error = require('./middleware/error')

const app = express()

app.use(express.json())
app.use('/user', userRouter)
app.use('/auth', authRouter)
app.use('/work', workRouter)
app.use('/schedule', scheduleRouter)
app.use('/task', taskRouter)
app.use('/subtask', subtaskRouter)
app.use('/streak', streakRouter)
app.use('/scheduleWorkDone', scheduleWorkDoneRouter)

app.all('*', (req, res, next) => {
    return res.status(404).json({
        err: `Endpoint ${req.url} does not exist`
    })
})

app.use(error)

app.listen(3001, () => {
    console.log('Listening on port 3001')
})
