const axios = require("axios");
const express = require("express");
const cors = require("cors")
const qs = require('qs');
const stream = require('stream')
const csv = require('csv-parser')

const PORT = 8080;

const app = express();
app.use(express.json())
app.use(cors())

app.listen(PORT, () => {
    console.log(`Running this application on the Port ${PORT}`);
});

app.post('/send-list', async (req, res) => {
    let senderId = req.body.spreadsheet.sender
    const numbersSent = []
    try {
        if (req.body.spreadsheet) {
            const bufferStream = new stream.PassThrough();
            req.body.spreadsheet = req.body.spreadsheet.base64.split(',').reverse()[0];
            req.body.spreadsheet = Buffer.from(req.body.spreadsheet, 'base64').toString('utf-8');
            if (req.body.spreadsheet.charCodeAt(0) === 0xFEFF) {
                req.body.spreadsheet = req.body.spreadsheet.substr(1);
            }
            bufferStream.end(req.body.spreadsheet);
            let rows = await new Promise((resolve, reject) => {
                const results = [];
                bufferStream
                    .pipe(csv({ separator: req.body.separator }))
                    .on('data', (data) => {
                        results.push(data)
                    })
                    .on('error', reject)
                    .on('end', () => {
                        resolve(results);
                    });
            });

            rows = rows.filter((row) => Object.keys(row).length !== 0)
                .map(r => r.value)
                .map(r => r.startsWith('55') ? '+' + r : '')
                .map(r => r.trim())

            const numbersWithError = []

            const totalSecondsUsed = []
            var min = 300_000  // envia no MÁXIMO 1 mensagem a cada 65 segundos  = 55msg/hora(valor em milisegundos)
            var max = 550_000 // max = max + min - envia no MÍNIMNO 1 mensagem a cada 55 seg + 65 seg = 120 segundos = 30msg/hora

            for (let i = 0; i < rows.length; i++) {
                totalSecondsUsed.push(Math.floor(Math.random() * max) + min) //inserting randomic interval seconds generate
            }
            let segundos = totalSecondsUsed[0];

            for (let index = 0; index < rows.length; index++) {
                const number = rows[index]
                console.log(`enviando para ${number} - senderId: ${senderId}`)
                const date = new Date()
                try {
                    await axios.post("http://localhost:8000/send-message", qs.stringify({ sender: senderId, number: number, message: `${returnRandomItems(arrMsgs)}` }), { timeout: 1000 })
                    numbersSent.push(number)
                    console.log(`último número enviado ${number} - sender: ${senderId} - ${date.toLocaleTimeString()}.${date.getMilliseconds()}Z`)
                } catch (error) {
                    if (!error.response || error.code === 'ECONNABORTED') {
                        // network error
                      }
                    numbersWithError.push(number)
                    console.log(`numero com erro: ${number}, error message: ${error?.message}, name: ${error?.name}, error: ${error?.error}, error code: ${error?.code}`)
                }
                date.setSeconds(date.getSeconds() + segundos / 1_000)
                console.log(`próximo envio em: ${date.toLocaleTimeString()}.${date.getMilliseconds()}Z`)
                await sleep(segundos)
                segundos = totalSecondsUsed[index + 1]
            }

            res.json({
                numbersSent,
                numbersWithError,
                quantityNumbersWithError: numbersWithError.length,
                numbersWithSuccess: numbersSent.length
            })
        }
    } catch (err) {
        console.log('catch')
        console.log(`error message: ${err}, name: ${err.name}`)
        res.status(500).json({
            error: err.error,
            numbersSent,
            numbersWithSuccess: numbersSent.length
        })
    }
})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const arrMsgs = [
    "Oi, tudo bem? 😄",
    "Oii! Tudo bem? 😅",
    "Oi, tudo bem?? 💙",
    "Olá! Tudo bom? 😅 💙",
    "Opa, tudo bem?? 💙",
    "Oi! Tudo bem com você? 💙",
    "Oii! Tudo bem com você? 💙",
    "Opa! Como vai? 💙",
    "Oii!! tudo bom?? 😅",
    "Oi!! Como você está? 😅", 
    "Oi!! Tudo bem com você? 😅 💙"
]
function returnRandomItems(arr) {
    const randomIndex = Math.floor(Math.random() * arr.length);
    const item = arr[randomIndex];
    return item;
}