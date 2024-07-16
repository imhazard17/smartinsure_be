const z = require('zod')

const userSchema = z.object({
    username: z.string().min(5).max(30),
    password: z.string().min(8).max(30),
    firstName: z.string().max(30),
    lastName: z.string().max(30),
})
