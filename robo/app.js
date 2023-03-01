const { Client, Buttons, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const port = process.env.PORT || 8000;
const cors = require("cors")

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.json())
app.use(cors())
app.use(express.urlencoded({
  extended: true
}));

/**
 * BASED ON MANY QUESTIONS
 * Actually ready mentioned on the tutorials
 * 
 * The two middlewares above only handle for data json & urlencode (x-www-form-urlencoded)
 * So, we need to add extra middleware to handle form-data
 * Here we can use express-fileupload
 */
app.use(fileUpload({
  debug: false
}));

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function (id, description) {
  console.log('Creating session: ' + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id
    })
  });

  client.initialize();

  client.on('qr', (qr) => {
    // console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, src: url });
      io.emit('message', { id: id, text: 'QR Code received, scan please!' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is ready!' });

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is authenticated!' });
  });

  client.on('auth_failure', function () {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });



  client.on('message', message => {

    const arrLinks = [
      "https://wa.me/message/WBNUEDOCNDPQE1",
      "https://wa.me/message/CDG5YZDR2TKGN1",
      "https://wa.me/message/V5QWMZWZSMB2E1",
      "https://wa.me/message/OZ25EN777Q4KP1",
      "https://wa.me/message/IKL74KBH7PBII1",
      "https://wa.me/message/DKIV6CECL55MD1"
    ]

    const arrCharacters = [
      ".",
      "!🤑🤑",
      "!!🤑",
      ".",
      "...",
      "!.",
      "!"
    ]

    const arrMsgs = [
      `Oi, sou especialista da IGU.
  Notamos que se aposentou recentemente e ficamos muito felizes com isso, afinal é uma conquista!
  Acredito que deve estar recebendo muitas ligações de bancos e financeiras e sabemos que isso é inconveniente, viemos solucionar esse problema de modo eficaz e temos uma proposta totalmente diferente para você. 
  Acesse o nosso link para descobrir esse segredo só nosso:
  https://sejaigu.com/contrate-inss`,
      `Opa, tudo bem? Vou te contar uma mega novidade!
  Sou especialista em liberações do INSS através da IGU, e aqui acompanho clientes disponíveis para conseguir liberação. Bem diferente das propostas que você possivelmente já vem recebendo! Que bom poder te atender!
  Vou dedicar um link exclusivo para que você conheça toda essa proposta, ta?
  https://sejaigu.com/contrate-inss`,
      `Que tá uma proposta especial e diferente de tudo que já viu para seu benefício?
  Essa é minha missão, te ajudar! Através de um atendimento totalmente exclusivo vamos tirar seu sonhos do papel, no link abaixo eu te conto o segredo para ter taxas de juros menores e liberação que você precisa! 
  https://sejaigu.com/contrate-inss
  Sou especialista em negociações financeiros aqui na IGU.
  Conte comigo!`,
      `Tudo bem por ai? Espero que sim! 
  Sou especialista em negociações financeiras da IGU, e vim aqui atender clientes em potencial de ajuda, vamos resolver sua vida financeira hoje? 
  Muitas vezes aquela divida ou projeto só está pendente por falta de recurso e hoje consigo liberações com a menor taxa do mercado, uma parcela que cabe no seu bolso e sem dúvidas um saldo que te ajudará muito! Para saber mais eu separei um link exclusivo para que qualquer ajuste façamos por lá! Clica aqui https://sejaigu.com/contrate-inss`,
      `Parabéns, você agora é beneficiário INSS! Devo confessar fico muito feliz em saber disso, da última vez que nos falamos não tínhamos concluído ainda! Voltei aqui só pra te contar uma excelente novidade, estamos com condições nas liberações esta semana, e quando vi seu nome separei logo uma proposta especial, vou deixar o link aqui, clica e descubra tudo! Caso tenha alguma dúvida chama, viu?
      https://sejaigu.com/contrate-inss`,
      `Oi, vou te contar uma mega novidade!
  Sou especialista em liberações INSS através da IGU, e aqui acompanho clientes disponíveis para conseguir seu dinheiro com taxas de condições especiais, que bom poder te atender!
  Vou dedicar um link exclusivo para que você conheça toda essa proposta, tá?
  https://sejaigu.com/contrate-inss`,
      `Oi, tudo bem? Sou especialista da IGU.

Descobrimos que você alcançou a sua esperada aposentadoria recentemente e por isso, queremos te presentear.
      
Acredito você deva estar recebendo muitas ligações de bancos e financeiras oferecendo propostas repetitivas. Sabemos o quanto isso é inconveniente, e viemos solucionar esse problema. Aqui trazemos uma grande novidade especial para você.  
Acesse o nosso link para descobrir esse segredo só nosso:
      
https://sejaigu.com/contrate-inss`,
      `Opa, tudo bem? Tenho uma grande novidade para você!
Sou especialista em liberações do INSS através da IGU, e aqui acompanho clientes com benefícios disponíveis. E achei de bom grado vir te contar que você se encaixa muito bem no nosso perfil de clientes, visto que se aposentou recentemente. 
Bem diferente das propostas que você possivelmente já vem recebendo, viemos apresentar nosso projeto. Contamos com você!
Vou dedicar um link exclusivo para que você conheça toda essa proposta, ta?
https://sejaigu.com/contrate-inss`,
    ]

    function returnRandomItems(arr) {
      const randomIndex = Math.floor(Math.random() * arr.length);
      const item = arr[randomIndex];
      return item;
    }



    if (message.body.includes('mensagens') || message.body.includes('atualizou')) {

    } else {
      // let button = new Buttons('Button body', [{ body: 'Ir para site' }, { body: 'Atendente' }], 'Canal automatizado', 'tudo para seu sucesso !');
      // message.reply(button)
      message.reply(`${returnRandomItems(arrMsgs)}`)
      // message.reply(`https://sejaigu.com/ `)
    }
    // let button = new Buttons('Button body', [{ body: 'Ir para site' }, { body: 'Atendente' }], 'Canal automatizado', 'tudo para seu sucesso !');
    // message.reply(button)
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
}

const init = function (socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       * 
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
      savedSessions.forEach((e, i, arr) => {
        arr[i].ready = false;
      });

      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(sess.id, sess.description);
      });
    }
  }
}

init();

// Socket IO
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});

// Send message
app.post('/send-message', async (req, res) => {
  console.log(req.body);

  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }

  /**
   * Check if the number is already registered
   * Copied from app.js
   * 
   * Please check app.js for more validations example
   * You can add the same here!
   */
  try {
    const isRegisteredNumber = await client.isRegisteredUser(number);

    if (!isRegisteredNumber) {
      return "the number is not registered"
    }
  } catch (error) {
    return "erro number"
  }


  client.sendMessage(number, message).then(response => {
    return 'ok'
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});



server.listen(port, function () {
  console.log('App running on *: ' + port);
});
