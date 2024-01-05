const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

const dotenv = require('dotenv')
dotenv.config()

app.post('/webhook', (req, res) => {
    const request = req.body
    console.log(request)

    const call = {
        employee: request["Funcionário"],
        problem: request["Tipo do problema/solicitação"],
        priority: request["Prioridade"],
        place: request["Onde você se encontra?"],
        description: request["Descrição:"]
    }

    // Create Trello Card

    const CardInfo = {
        name: `${call.employee} - ${call.problem}`,
        desc: `## ${call.description} \n---\n**Funcionário:** ${call.employee}\n**Tipo de problema:** ${call.problem}\n**Prioridade:**${call.priority}\n**Local:** ${call.place}\n> *Arthur automatizações vrum vrum*`
    }
    fetch(`https://api.trello.com/1/cards?idList=${process.env.TRELLO_IDLIST}&key=${process.env.TRELLO_APIKEY}&token=${process.env.TRELLO_APITOKEN}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(CardInfo)
    })
        .then(response => {
            console.log(
                `Response: ${response.status} ${response.statusText}`
            );
            return response.text();
        })
        .then(text => console.log(text))
        .catch(err => console.error(err))

    res.status(200).send("OK")
})

app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})
app.listen(process.env.PORT || 3000)