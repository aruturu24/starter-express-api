const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

app.post('/webhook', (req, res) => {
    const request = req.body

    const call = {
        employee: req.body["Funcionário"],
        problem: req.body["Tipo do problema/solicitação"],
        priority: req.body["Prioridade"],
        place: req.body["Onde você se encontra?"],
        description: req.body["Descrição:"]
    }

    console.log(call)

    res.status(200).send("OK")
})

app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})
app.listen(process.env.PORT || 3000)


/*const APIKey = "aaa"
const APIToken = "aaa"

const CardInfo = {
    name: "teste",
    desc: "# teste"
}
fetch(`https://api.trello.com/1/cards?idList=aaa&key=${APIKey}&token=${APIToken}`, {
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
    .catch(err => console.error(err));*/