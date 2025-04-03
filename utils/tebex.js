const fetch = require("node-fetch");

const getTransaction = async(client, transactionId) => {
  let transaction = await fetch(`https://plugin.tebex.io/payments/${transactionId}`, {
    headers: {
      "X-Tebex-Secret": `${client.config.tebex.secret}`,
			"Content-Type": "application/json",
    }
  });

  let result = await transaction.json();
  if(result.error_code) return client.utils.sendError("Clave secreta de Tebex en el archivo de configuración (tebex.secret) no es válido o no existe.");

  return result;
}

module.exports = {
  getTransaction,
}