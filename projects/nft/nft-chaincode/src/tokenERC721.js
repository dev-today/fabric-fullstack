const { Contract } = require("fabric-contract-api");

// Definir nombres de tipo de objeto para el prefijo
const balancePrefix = "balance";
const nftPrefix = "nft";
const approvalPrefix = "approval";

// Definir nombres clave para las opciones
const nameKey = "name";
const symbolKey = "symbol";
const tslog = require("tslog");
const log = new tslog.Logger({});
class TokenERC721Contract extends Contract {
  async ping(ctx) {
    log.info("ping");
    return "pong";
  }

  /**
   * Balance de cuenta todos los tokens no fungibles asignados a un propietario
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} owner Un propietario para quién consultar el saldo
   * @returns {Number} El número de tokens no fundamentales propiedad del propietario, posiblemente cero
   */
  async BalanceOf(ctx, owner) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Hay un registro clave para cada token no fungible en el formato de balancePrefix.owner.tokenId.
    // BalanceOf() consulta y cuenta todos los registros que coincidan con balancePrefix.propietario.*
    const iterator = await ctx.stub.getStateByPartialCompositeKey(
      balancePrefix,
      [owner]
    );

    // Contar el número de claves compuestas devueltas
    let balance = 0;
    let result = await iterator.next();
    while (!result.done) {
      balance++;
      result = await iterator.next();
    }
    return balance;
  }

  /**
   * El dueño de un token no fungible
   *
   * @param {Context} ctx el contexto de transaccion
   * @param {String} tokenId El identificador para un token no fungible
   * @returns {String} Devuelve el propietario del token no fungible
   */
  async OwnerOf(ctx, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const nft = await this._readNFT(ctx, tokenId);
    const owner = nft.owner;
    if (!owner) {
      throw new Error("Este token no tiene propietario");
    }

    return owner;
  }

  /**
   * Transferir de transferencias la propiedad de un token no fungible
   * de un propietario a otro propietario
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} from El dueño actual del token no fungible
   * @param {String} to El nuevo propietario
   * @param {String} tokenId el token no fungible para transferir
   * @returns {Boolean} Devolver si la transferencia fue exitosa o no
   */
  async TransferFrom(ctx, from, to, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const sender = ctx.clientIdentity.getID();

    const nft = await this._readNFT(ctx, tokenId);

    // Comprobar si el remitente es el propietario actual, un operador autorizado,
    // o el cliente aprobado para este token no fungible.
    const owner = nft.owner;
    const tokenApproval = nft.approved;
    const operatorApproval = await this.IsApprovedForAll(ctx, owner, sender);
    log.info(owner, sender);
    if (owner !== sender && tokenApproval !== sender && !operatorApproval) {
      throw new Error("El remitente no puede transferir el token no fungible");
    }

    // Comprobar si `from` es el propietario actual
    if (owner !== from) {
      throw new Error("El que intenta transferir no es el propietario actual.");
    }

    // Limpiar el cliente aprobado para este token no fungible
    nft.approved = "";

    // Sobrescribir un token no fungible para asignar un nuevo propietario.
    nft.owner = to;
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    // Eliminar una clave compuesta del saldo del propietario actual
    const balanceKeyFrom = ctx.stub.createCompositeKey(balancePrefix, [
      from,
      tokenId,
    ]);
    await ctx.stub.deleteState(balanceKeyFrom);

    // Guardar una clave compuesta para contar el saldo de un nuevo propietario
    const balanceKeyTo = ctx.stub.createCompositeKey(balancePrefix, [
      to,
      tokenId,
    ]);
    await ctx.stub.putState(balanceKeyTo, Buffer.from("\u0000"));

    // Emite el evento Transfer
    const tokenIdInt = parseInt(tokenId);
    const transferEvent = { from: from, to: to, tokenId: tokenIdInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    return true;
  }

  /**
   * Aprueba cambios o reafirma al cliente aprobado para un token no fungible
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} approved El nuevo cliente aprobado
   * @param {String} tokenId el token no fungible para aprobar
   * @returns {Boolean} Devolver si la aprobación fue exitosa o no
   */
  async Approve(ctx, approved, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const sender = ctx.clientIdentity.getID();

    const nft = await this._readNFT(ctx, tokenId);

    // Comprobar si el remitente es el propietario actual del token no fungible
    // o un operador autorizado del propietario actual
    const owner = nft.owner;
    const operatorApproval = await this.IsApprovedForAll(ctx, owner, sender);
    if (owner !== sender && !operatorApproval) {
      throw new Error(
        "El remitente no es el propietario actual ni un operador autorizado"
      );
    }

    // Actualizar el cliente aprobado del token no fungible
    nft.approved = approved;
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    // Emitir el evento de Aprobación
    const tokenIdInt = parseInt(tokenId);
    const approvalEvent = {
      owner: owner,
      approved: approved,
      tokenId: tokenIdInt,
    };
    ctx.stub.setEvent("Approval", Buffer.from(JSON.stringify(approvalEvent)));

    return true;
  }

  /**
   * SetApprovalForAll habilita o deshabilita la aprobación de un tercero ("Operador")
   * para administrar todos los activos del remitente del mensaje
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} operator Un cliente para agregar al conjunto de operadores autorizados
   * @param {Boolean} approved Verdadero si el operador está aprobado, falso para revocar la aprobación
   * @returns {Boolean} Devolver si la aprobación fue exitosa o no
   */
  async SetApprovalForAll(ctx, operator, approved) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const sender = ctx.clientIdentity.getID();

    const approval = { owner: sender, operator: operator, approved: approved };
    const approvalKey = ctx.stub.createCompositeKey(approvalPrefix, [
      sender,
      operator,
    ]);
    await ctx.stub.putState(approvalKey, Buffer.from(JSON.stringify(approval)));

    // Emite el evento ApprovalForAll
    const approvalForAllEvent = {
      owner: sender,
      operator: operator,
      approved: approved,
    };
    ctx.stub.setEvent(
      "ApprovalForAll",
      Buffer.from(JSON.stringify(approvalForAllEvent))
    );

    return true;
  }

  /**
   * GetApproved Devuelve el cliente aprobado para un solo token no fungible
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} tokenId el token no fungible para encontrar el cliente aprobado para
   * @returns {Object} Devuelve el cliente aprobado para este token no fungible, o nulo si no hay ninguno
   */
  async GetApproved(ctx, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const nft = await this._readNFT(ctx, tokenId);
    return nft.approved;
  }

  /**
   * IsApprovedForAll Devuelve si un cliente es un operador autorizado para otro cliente
   *
   * @param {Context} ctx el contexto de transaccion
   * @param {String} owner El cliente que posee los tokens no fungibles
   * @param {String} operator El cliente que actúa en nombre del propietario
   * @returns {Boolean} Devolver true si el operador es un operador aprobado para el propietario, de lo contrario false
   */
  async IsApprovedForAll(ctx, owner, operator) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const approvalKey = ctx.stub.createCompositeKey(approvalPrefix, [
      owner,
      operator,
    ]);
    const approvalBytes = await ctx.stub.getState(approvalKey);
    let approved;
    if (approvalBytes && approvalBytes.length > 0) {
      const approval = JSON.parse(approvalBytes.toString());
      approved = approval.approved;
    } else {
      approved = false;
    }

    return approved;
  }

  // ============== Extensión de metadatos ERC721 ===============

  /**
   * El nombre devuelve un nombre descriptivo para una colección de tokens no fungibles en este contrato
   *
   * @param {Context} ctx el contexto de transaccion
   * @returns {String} Devuelve el nombre del token
   */
  async Name(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const nameAsBytes = await ctx.stub.getState(nameKey);
    return nameAsBytes.toString();
  }

  /**
   * El símbolo devuelve un nombre abreviado para tokens no fungibles en este contrato.
   *
   * @param {Context} ctx el contexto de transaccion
   * @returns {String} Devuelve el símbolo del token
   */
  async Symbol(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const symbolAsBytes = await ctx.stub.getState(symbolKey);
    return symbolAsBytes.toString();
  }

  /**
   * Tokenuri devuelve un identificador de recursos uniforme (URI) distinto para un token dado.
   *
   * @param {Context} ctx el contexto de transaccion
   * @param {string} tokenId The identifier for a non-fungible token
   * @returns {String} Returns the URI of the token
   */
  async TokenURI(ctx, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const nft = await this._readNFT(ctx, tokenId);
    return nft.tokenURI;
  }

  /**
   * GetToken devuelve los datos para un token dado.
   *
   * @param {Context} ctx el contexto de transacción
   * @param {string} tokenId El identificador para un token no fungible
   * @returns {String} Devuelve los datos del token
   */
  async GetToken(ctx, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const nft = await this._readNFT(ctx, tokenId);
    return nft;
  }

  // ============== Extensión de enumeración ERC721 ===============

  /**
   * GetTokens devuelve tokens no fungibles rastreados por este contrato.
   *
   * @param {Context} ctx el contexto de transacción
   * @returns {Number} Devuelve todos los tokens no fungibles válidos rastreados por este contrato.
   */
  async GetTokens(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Hay un registro clave para cada token no fungible con el formato nftPrefix.tokenId.
    // NFTs() consulta y devuelve todos los registros que coincidan con nftPrefix.*
    const iterator = await ctx.stub.getStateByPartialCompositeKey(
      nftPrefix,
      []
    );

    // Contar el número de claves compuestas devueltas
    const items = [];
    let result = await iterator.next();
    while (!result.done) {
      const value = JSON.parse(result.value.value.toString("utf8"));
      items.push(value);
      result = await iterator.next();
    }
    return items;
  }

  /**
   * Totalsupply cuenta tokens no fungibles rastreados por este contrato.
   *
   * @param {Context} ctx el contexto de transaccion
   * @returns {Number} Devuelve un recuento de tokens no fungibles válidos rastreados por este contrato, donde cada uno de ellos tiene un propietario asignado y consultable.
   */
  async TotalSupply(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Hay un registro clave para cada token no fungible con el formato nftPrefix.tokenId.
    // TotalSupply() consulta y cuenta todos los registros que coincidan con nftPrefix.*
    const iterator = await ctx.stub.getStateByPartialCompositeKey(
      nftPrefix,
      []
    );

    // Contar el número de claves compuestas devueltas
    let totalSupply = 0;
    let result = await iterator.next();
    while (!result.done) {
      totalSupply++;
      result = await iterator.next();
    }
    return totalSupply;
  }

  // ============== Funciones extendidas para esta muestra ===============

  /**
   * Establezca información opcional para un token.
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} name El nombre del token
   * @param {String} symbol El símbolo del token
   */
  async Initialize(ctx, name, symbol) {
    // Verifique la autorización del administrador: esta muestra asume que Org1 es el emisor con privilegios para inicializar el contrato (establezca el nombre y el símbolo)
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== "Org1MSP") {
      throw new Error(
        `client is not authorized to set the name and symbol of the token ${clientMSPID}`
      );
    }

    // compruebe que las opciones de contrato aún no están configuradas, el cliente no está autorizado a cambiarlas una vez inicializado
    const nameBytes = await ctx.stub.getState(nameKey);
    if (nameBytes && nameBytes.length > 0) {
      throw new Error(
        "Las opciones de contrato ya están establecidas, el cliente no está autorizado para cambiarlas"
      );
    }

    await ctx.stub.putState(nameKey, Buffer.from(name));
    await ctx.stub.putState(symbolKey, Buffer.from(symbol));
    return true;
  }

  /**
   * Crea un nueva token no fungible
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} tokenId ID única del token no fungible para ser acuñado
   * @param {String} tokenURI Uri que contiene metadatos del token no fungible acuñado
   * @returns {Object} Devuelve el objeto token no fungible
   */
  async Mint(ctx, tokenId, tokenURI, name, description) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Comprobar la autorización de minter: este ejemplo supone que Org1 es el emisor con privilegios para acuñar un nuevo token
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== "Org1MSP") {
      throw new Error("El cliente no está autorizado a crear nuevos tokens");
    }
    // Obtener ID de la identidad del cliente que envía
    const minter = ctx.clientIdentity.getID();
    log.info(minter, "MINTER");

    // Comprobar si el token a acuñar no existe
    const exists = await this._nftExists(ctx, tokenId);
    if (exists) {
      throw new Error(`El token ${tokenId} ya está minted.`);
    }

    // Agregar un token no fungible
    const tokenIdInt = parseInt(tokenId);
    if (isNaN(tokenIdInt)) {
      throw new Error(
        `El tokenid ${tokenId} no es válido. Tokenid debe ser un numero`
      );
    }
    const nft = {
      tokenId: tokenIdInt,
      owner: minter,
      tokenURI: tokenURI,
      name: name,
      description: description,
    };
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    // Una clave compuesta sería balancePrefix.owner.tokenId, que habilita parcial
    // consulta de clave compuesta para buscar y contar todos los registros que coincidan con balance.propietario.*
    // Un valor vacío representaría una eliminación, así que simplemente insertamos el carácter nulo.
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [
      minter,
      tokenId,
    ]);
    await ctx.stub.putState(balanceKey, Buffer.from("\u0000"));

    // Emite el evento Transfer
    const transferEvent = { from: "0x0", to: minter, tokenId: tokenIdInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    return nft;
  }
  async limpiarChaincode(ctx) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(
      nftPrefix,
      []
    );

    let result = await iterator.next();
    while (!result.done) {
      await ctx.stub.deleteState(result.value.key);
      result = await iterator.next();
    }
    return "OK"
  }

  /**
   * Quemar un token no fungible
   *
   * @param {Context} ctx el contexto de transacción
   * @param {String} tokenId ID única de un token no fungible
   * @returns {Boolean} Regresar si la quemadura fue exitosa o no
   */
  async Burn(ctx, tokenId) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    const owner = ctx.clientIdentity.getID();

    // Comprobar si una persona que llama es el propietario del token no fungible
    const nft = await this._readNFT(ctx, tokenId);
    if (nft.owner !== owner) {
      throw new Error(
        `Token no fungible ${tokenId} no es propiedad de ${owner}`
      );
    }

    // Eliminar el token
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.deleteState(nftKey);

    // Eliminar una clave compuesta del saldo del propietario
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [
      owner,
      tokenId,
    ]);
    await ctx.stub.deleteState(balanceKey);

    // Emite el evento Transfer
    const tokenIdInt = parseInt(tokenId);
    const transferEvent = { from: owner, to: "0x0", tokenId: tokenIdInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    return true;
  }

  async _readNFT(ctx, tokenId) {
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    const nftBytes = await ctx.stub.getState(nftKey);
    if (!nftBytes || nftBytes.length === 0) {
      throw new Error(`El tokenid ${tokenId} no es válido. No existe`);
    }
    const nft = JSON.parse(nftBytes.toString());
    return nft;
  }

  async _nftExists(ctx, tokenId) {
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    const nftBytes = await ctx.stub.getState(nftKey);
    return nftBytes && nftBytes.length > 0;
  }

  /**
   * ClientAccountBalance devuelve el saldo de la cuenta del cliente solicitante.
   *
   * @param {Context} ctx el contexto de transacción
   * @returns {Number} Devuelve el saldo de la cuenta
   */
  async ClientAccountBalance(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Obtener ID de la identidad del cliente que envía
    const clientAccountID = ctx.clientIdentity.getID();
    return this.BalanceOf(ctx, clientAccountID);
  }

  // ClientAccountID devuelve el id de la cuenta del cliente solicitante.
  // En esta implementación, el ID de la cuenta del cliente es el propio ID del cliente.
  // Los usuarios pueden usar esta función para obtener su propia identificación de cuenta, que luego pueden dar a otros como la dirección de pago
  async ClientAccountID(ctx) {
    // verifique que las opciones de contrato ya estén configuradas primero para ejecutar la función
    await this.CheckInitialized(ctx);

    // Obtener ID de la identidad del cliente que envía
    const clientAccountID = ctx.clientIdentity.getID();
    return clientAccountID;
  }

  // Comprueba que las opciones de contrato ya hayan sido inicializadas
  async CheckInitialized(ctx) {
    const nameBytes = await ctx.stub.getState(nameKey);
    if (!nameBytes || nameBytes.length === 0) {
      throw new Error(
        "Las opciones de contrato deben establecerse antes de llamar a cualquier función, llame a Initialize() para inicializar el contrato"
      );
    }
  }
}

module.exports = TokenERC721Contract;
