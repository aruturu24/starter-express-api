const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

const dotenv = require('dotenv')
const {response} = require("express");
const {GoogleSpreadsheet} = require("google-spreadsheet");
const {JWT} = require("google-auth-library");
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

app.head('/updateSheets', async (req, res) => {
    const request = req.body
    res.status(200).send('Webhook connected!')
})
app.post('/updateSheets', async (req, res) => {
    const request = req.body

    if (request.action.display.translationKey !== 'action_move_card_from_list_to_list') {
        res.status(400).send('Is not a card move in Trello')
    } else if (request.action.data.listAfter.name !== 'Chamados Realizados') {
        res.status(400).send('Is not the right list')
    }

    const CardId = request.action.display.entities.card.id
    const CardTrello = await fetchApiTrello(`cards/${CardId}`, null,'GET')

    const Sheet = await prepareCallSheet()
    const IsStatusChanged = changeCallStatus(Sheet, CardTrello.desc, "Concluído")
    if (IsStatusChanged === false) {
        res.status(400).send('Can not find the specified call in the sheet')
    }

    await Sheet.saveUpdatedCells();

    res.status(200).send('Sheet updated!')

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
                `## ${call.description}\n---\n` +
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
                `## Cliente: **${call.client}**\n---\n` +
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

async function fetchApiTrello(path, body, method = 'POST') {
    const response = await fetch(`https://api.trello.com/1/${path}?key=${process.env.TRELLO_APIKEY}&token=${process.env.TRELLO_APITOKEN}`, {
        method: method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    })

    const TrelloCard = await response.text()

    console.log(
        `Fetching: Trello/${path}\n`,
        `Response: ${response.status} ${response.statusText}`
    )
    return JSON.parse(TrelloCard)
}

async function prepareCallSheet() {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_CALLS_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsById[process.env.SHEET_CALLS_ID]
    await sheet.loadCells(`K${process.env.SHEET_START_ROW}:AM${process.env.SHEET_END_ROW}`)
    return sheet
}

function changeCallStatus(sheet, desc, status) {
    let wasFound = false
    if (desc.startsWith('## Cliente:')) {
        const description = desc.slice(14).split('*')[0]

        for (let i = process.env.SHEET_START_ROW; i < process.env.SHEET_END_ROW; i++) {
            if (sheet.getCellByA1(`M${i}`).value === description) {
                sheet.getCellByA1(`AL${i}`).value = status
                wasFound = true;
            }
        }
        return wasFound
    }
    const description = desc.slice(3).split(' \n---')[0]

    for (let i = process.env.SHEET_START_ROW; i < process.env.SHEET_END_ROW; i++) {
        if (sheet.getCellByA1(`AJ${i}`).value === description) {
            sheet.getCellByA1(`AL${i}`).value = status
            wasFound = true
        }
    }

    return wasFound
}