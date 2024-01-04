const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

app.post('/webhook', (req, res) => {
    console.log(req.body)
    res.status(200).send("OK")
})

app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})
app.listen(process.env.PORT || 3000)