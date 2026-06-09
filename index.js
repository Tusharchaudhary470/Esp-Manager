require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const authRoutes = require('./routes/auth')
const teamRoutes = require('./routes/team')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/team', teamRoutes)

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err))

app.get('/', (req, res) => {
  res.send('FF Finance API running')
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
