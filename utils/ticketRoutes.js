const router = require("express").Router();
const fs = require("fs");
const yaml = require("yaml");
const config = yaml.parse(fs.readFileSync('./configs/config.yml', 'utf8'));
const language = yaml.parse(fs.readFileSync('./configs/language.yml', 'utf8'));

// Route for Ticket Transcript
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let accessCode = req.query.accessCode;
  let fileLoc = `./transcripts/ticket-${id}.html`;
  let fileExist = fs.existsSync(fileLoc);
  if (!fileExist) return res.send(`Ticket con ID ${id} no existe.`);
  let fileToSend = fs.readFileSync(fileLoc, "utf8");

  fileToSend += `
    <head>
      <title>Transcripción de ticket</title>
    </head>
  `;
  
  if(config.server.selfhost.public_transcripts == false) {
    let transcriptCode = await req.client.database.transcriptsData().get(`${id}`) || { code: config.server.selfhost.admin_login };
    let promptTitle = language.ticket.transcript_prompt;
    
    if ((!accessCode || transcriptCode.code != accessCode) && accessCode != config.server.selfhost.admin_login && accessCode != "exit") return res.send(`
          <script>
            window.location.href = "/transcripts/${id}?accessCode="+prompt("${promptTitle}");
          </script>
        `);
    
    if (accessCode == "exit")
      return res.send();
  }
  
  res.send(fileToSend);
});

// Route for Downloading Ticket Transcript
router.get("/:id/download", async (req, res) => {
  if (config.server.selfhost.download == false) return res.send("Transcript downloading is disabled.");

  let id = req.params.id;
  let accessCode = req.query.accessCode;
  let fileLoc = `./transcripts/ticket-${id}.html`;
  let fileExist = fs.existsSync(fileLoc);
  if (!fileExist) return res.send(`Ticket with ID ${id} doesn't exist.`);
  
  if(config.server.selfhost.public_transcripts == false) {
    let transcriptCode = await req.client.database.transcriptsData().get(`${id}`) || { code: config.server.selfhost.admin_login };
    let promptTitle = language.ticket.transcript_prompt;
    
    if ((!accessCode || transcriptCode.code != accessCode) && accessCode != config.server.selfhost.admin_login && accessCode != "exit") return res.send(`
          <script>
            window.location.href = "/transcripts/${id}/download?accessCode="+prompt("${promptTitle}");
          </script>
        `);
    
    if (accessCode == "exit")
      return res.send();
  }

  res.download(fileLoc, `transcript-${id}.html`);
});

module.exports = router;
