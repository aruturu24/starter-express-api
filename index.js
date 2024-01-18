const express = require('express')
const app = express()

const bodyParser = require('body-parser')
app.use(bodyParser.json())

const dotenv = require('dotenv')
dotenv.config()

const {GoogleSpreadsheet} = require("google-spreadsheet");
const {JWT} = require("google-auth-library");

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
        digital_measure: request["Trena Digital:"],
        electric: request["Elétrica"],
        civil: request["Civil"],
        mechanic: request["Mecânica"],
        epi: request["EPI'S"],
        date: request["Data e hora da Retirada"],
        description: request["Descrição:"]
    }

    const TrelloCard = await fetchApiTrello("cards", createCardInfo(call))

    if (call.problem === "Solicitação de equipamento para auditoria") {
        const equipments = [
            call.tablets + ' tablets',
            call.thermal.reduce((acc, cur) => {
                return acc + parseInt(cur)
            }, 0) + ' Termovisores',
            call.digital_measure + ' Trenas digital',
            ...call.electric, ...call.civil, ...call.mechanic, ...call.epi
        ]

        await createChecklist(TrelloCard.id, "Equipamentos", equipments)
    }

    res.status(200).send(call)
})
app.head('/updateSheets', async (req, res) => {
    res.status(200).send('Webhook connected!')
})
app.post('/updateSheets', async (req, res) => {
    const request = req.body

    if (request.action.display.translationKey !== 'action_move_card_from_list_to_list') return res.status(400).send('Is not a card move in Trello')
    if (request.action.data.listAfter.name !== 'Chamados Realizados') return res.status(400).send('Is not the right list')

    const CardTrello = await fetchApiTrello(`cards/${request.action.display.entities.card.id}`, null, 'GET')

    const Sheet = await prepareCallSheet()
    const IsStatusChanged = changeCallStatus(Sheet, CardTrello.desc, "Concluído")
    if (IsStatusChanged === false) return res.status(400).send('Can not find the specified call in the sheet')
    console.log('Saving sheet alterations...')
    await Sheet.saveUpdatedCells();

    res.status(200).send('Sheet updated!')
})
app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})
app.listen(process.env.PORT || 3000)

async function createChecklist(cardId, checklist) {
    const TrelloChecklist = await fetchApiTrello("checklists", {idCard: cardId, name: checklist.name})

    console.log('Creating the Checklist')
    for (const item of checklist.items) await fetchApiTrello(`checklists/${TrelloChecklist.id}/checkItems`, {
        name: item,
        checked: false
    })
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
                `**Prioridade:** ${call.priority}\n` +
                `**Local:** ${call.place}\n` +
                `> *Arthur automatizações vrum vrum*`
        }
    }

    return {
        idList: process.env.TRELLO_IDLIST,
        name: `${call.employee} - ${call.problem}`,
        desc:
            `## Cliente: **${call.client}**\n---\n` +
            `**Tablets:** ${call.tablets[0]}\n` +
            `**Termovisores:** ${parseInt(call.thermal[0]) + parseInt(call.thermal[1]) + parseInt(call.thermal[2])}\n` +
            `**Trena Digital:** ${call.digital_measure[0]}\n` +
            `**Elétrica:**\n${call.electric.map((item) => " " + item)}\n` +
            `**Civil:**\n${call.civil.map(item => " " + item)}\n` +
            `**Mecânica:**\n${call.mechanic.map(item => " " + item)}\n` +
            `**EPI's:**\n${call.epi.map(item => " " + item)}\n` +
            `**Data e Hora da Retirada:** ${call.date}\n` +
            `> *Arthur automatizações vrum vrum*`,
        due: new Date(call.date).toISOString()
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

    console.log(
        `Fetching: Trello/${path}\n`,
        `Response: ${response.status} ${response.statusText}`
    )

    return JSON.parse(await response.text())
}

async function prepareCallSheet() {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    console.log('Loading calls sheet')
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
    const description = desc.slice(3).split('\n')[0]

    for (let i = process.env.SHEET_START_ROW; i < process.env.SHEET_END_ROW; i++) {
        if (sheet.getCellByA1(`AJ${i}`).value === description) {
            sheet.getCellByA1(`AL${i}`).value = status
            wasFound = true
        }
    }

    return wasFound
}