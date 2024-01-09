const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

const dotenv = require('dotenv')
const {response} = require("express");
dotenv.config()

app.post('/webhook', async (req, res) => {
    const request = req.body

    const call = {
        employee: request["Funcionário"],
        problem: request["Tipo do problema/solicitação"],
        priority: request["Prioridade"],
        place: request["Onde você se encontra?"],
        client: request["Cliente:"],
        tablets: request["Tablets:"],
        thermal: request["Termovisores:"],
        digitalmeasure: request["Trena Digital:"],
        eletric: request["Elétrica"],
        civil: request["Civil"],
        mech: request["Mecânica"],
        epi: request["EPI'S"],
        date: request["Data e hora da Retirada"],
        description: request["Descrição:"]
    }

    const cardInfo = createCardInfo(call)
    const TrelloCard = await fetchApiTrello("cards", cardInfo)

    if (call.problem == "Solicitação de equipamento para auditoria") {
        const equipments = [
            call.tablets + ' tablets',
            call.thermal.reduce((acc, cur) => {return acc + parseInt(cur)}, 0) + ' Termovisores',
            call.digitalmeasure + ' Trenas digital',
            ...call.eletric, ...call.civil, ...call.mech, ...call.epi
        ]
        await createChecklist(TrelloCard.id, "Equipamentos", equipments)
    }

    res.status(200).send(call)

})


app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})
app.listen(process.env.PORT || 3000)

async function createChecklist(cardId, checklistName, checklistItems) {
    const TrelloChecklist = await fetchApiTrello("checklists", {idCard: cardId, name: checklistName})

    for (const item of checklistItems) {
        await fetchApiTrello(`checklists/${TrelloChecklist.id}/checkItems`, {name: item, checked: false})
    }
}

function createCardInfo(call) {
    if (call.problem !== "Solicitação de equipamento para auditoria") {
        return {
            idList: process.env.TRELLO_IDLIST,
            name: `${call.employee} - ${call.problem}`,
            desc:
                `## ${call.description} \n---\n` +
                `**Funcionário:** ${call.employee}\n` +
                `**Tipo de problema:** ${call.problem}\n` +
                `**Prioridade:**${call.priority}\n` +
                `**Local:** ${call.place}\n` +
                `> *Arthur automatizações vrum vrum*`
        }
    } else {
        return {
            idList: process.env.TRELLO_IDLIST,
            name: `${call.employee} - ${call.problem}`,
            desc:
                `## Cliente: **${call.client}** \n---\n` +
                `**Tablets:** ${call.tablets[0]}\n` +
                `**Termovisores:** ${parseInt(call.thermal[0]) + parseInt(call.thermal[1]) + parseInt(call.thermal[2])}\n` +
                `**Trena Digital:** ${call.digitalmeasure[0]}\n` +
                `**Elétrica:**\n${call.eletric.map((item) => " " + item)}\n` +
                `**Civil:**\n${call.civil.map(item => " " + item)}\n` +
                `**Mecânica:**\n${call.mech.map(item => " " + item)}\n` +
                `**EPI's:**\n${call.epi.map(item => " " + item)}\n` +
                `**Data e Hora da Retirada:** ${call.date}\n` +
                `> *Arthur automatizações vrum vrum*`,
            due: new Date(call.date).toISOString()
        }
    }
}

async function fetchApiTrello(path, body) {
    const response = await fetch(`https://api.trello.com/1/${path}?key=${process.env.TRELLO_APIKEY}&token=${process.env.TRELLO_APITOKEN}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })

    const TrelloCard = await response.text()

    console.log(
        `Fetching: Trello/${path}\n`,
        `Response: ${response.status} ${response.statusText}`
    )
    return JSON.parse(TrelloCard)
}