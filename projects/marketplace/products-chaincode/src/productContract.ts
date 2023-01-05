import { Context } from "fabric-contract-api";
import { v5 as uuidv5 } from "uuid";

export const UUID_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

const { Contract } = require("fabric-contract-api");

// Definir nombres de tipo de objeto para el prefijo
const productPrefix = "product";
const ventaPrefix = "venta";
const balancePrefix = "balance";

const tslog = require("tslog");
const log = new tslog.Logger({});


const ALLOWED_MSPS_CREAR_PRODUCTOS = ["SonyMSP"];
const ALLOWED_MSPS_COMPRAR = ["MarketplaceMSP"];

class ProductContract extends Contract {
  async getMyIdentity(ctx: Context) {

    return {
      id: ctx.clientIdentity.getID(),
      mspId: ctx.clientIdentity.getMSPID(),
    };
  }
  async Ping(ctx: Context) {
    log.info("ping");
    return "pong";
  }

  async createProduct(
    ctx: Context,
    id: string,
    nombre: string,
    descripcion: string,
    precio: string,
    cantidad: string
  ) {
    if (!ALLOWED_MSPS_CREAR_PRODUCTOS.includes(ctx.clientIdentity.getMSPID())) {
      throw new Error("No tienes permiso para crear productos");
    }
    const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
    const precioInt = parseInt(precio);
    if (isNaN(precioInt)) {
      throw new Error("El precio debe ser un número");
    }
    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt)) {
      throw new Error("La cantidad debe ser un número");
    }
    const product = {
      id,
      nombre,
      descripcion,
      precio: precioInt,
      cantidad: cantidadInt,
      createdBy: ctx.clientIdentity.getID(),
    };
    await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
    log.info("Producto creado", product);
    return JSON.stringify(product);
  }

  async getProduct(ctx: Context, id: string) {
    const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
    const product = await ctx.stub.getState(productKey);
    return product.toString();
  }
  async updateProduct(
    ctx: Context,
    id: string,
    nombre: string,
    descripcion: string,
    precio: string,
    cantidad: string
  ) {
    if (!ALLOWED_MSPS_CREAR_PRODUCTOS.includes(ctx.clientIdentity.getMSPID())) {
      throw new Error("No tienes permiso para actualizar productos");
    }
    const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
    const precioInt = parseInt(precio);
    if (isNaN(precioInt)) {
      throw new Error("El precio debe ser un número");
    }
    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt)) {
      throw new Error("La cantidad debe ser un número");
    }
    const product = {
      id,
      nombre,
      descripcion,
      precio: precioInt,
      cantidad: cantidadInt,
      createdBy: ctx.clientIdentity.getID(),
    };
    await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
    return JSON.stringify(product);
  }
  async deleteProduct(ctx: Context, id: string) {
    if (!ALLOWED_MSPS_CREAR_PRODUCTOS.includes(ctx.clientIdentity.getMSPID())) {
      throw new Error("No tienes permiso para crear productos");
    }
    const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
    await ctx.stub.deleteState(productKey);
  }
  async getMyBalance(ctx: Context) {
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [ctx.clientIdentity.getID()]);
    const balance = await ctx.stub.getState(balanceKey);
    return balance.toString();
  }
  async setMyBalance(ctx: Context, balance: string) {
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [ctx.clientIdentity.getID()]);
    const balanceInt = parseInt(balance);
    if (isNaN(balanceInt)) {
      throw new Error("La cantidad debe ser un número");
    }
    const balanceItem = {
      balance: balanceInt,
    };
    await ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balanceItem)));
    return balanceItem
  }

  async comprar(ctx: Context, id: string, cantidad: string) {
    if (!ALLOWED_MSPS_COMPRAR.includes(ctx.clientIdentity.getMSPID())) {
      throw new Error("No tienes permiso para comprar");
    }
    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt)) {
      throw new Error("La cantidad debe ser un número");
    }

    const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
    const product = await ctx.stub.getState(productKey);
    const productJson = JSON.parse(product.toString());
    if (cantidadInt > productJson.cantidad) {
      throw new Error("No hay suficientes productos");
    }

    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [ctx.clientIdentity.getID()]);
    const balance = await ctx.stub.getState(balanceKey);
    const balanceJson = JSON.parse(balance.toString());
    if (balanceJson.balance < productJson.precio * cantidadInt) {
      throw new Error("No hay suficiente balance");
    }
    balanceJson.balance = balanceJson.balance - productJson.precio * cantidadInt;
    await ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balanceJson)));
    productJson.cantidad = productJson.cantidad - cantidadInt;
    await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(productJson)));

    const ventaId = uuidv5(ctx.stub.getTxID() + ctx.clientIdentity.getMSPID() + cantidad, UUID_NAMESPACE);
    const ventaKey = ctx.stub.createCompositeKey(ventaPrefix, [ctx.clientIdentity.getID(), ventaId]);
    const venta = {
      id: ventaId,
      cantidad: cantidadInt,
      compradoPor: ctx.clientIdentity.getID(),
    };

    await ctx.stub.putState(ventaKey, Buffer.from(JSON.stringify(venta)));
    return JSON.stringify(venta);
  }

  async getVenta(ctx: Context, id: string) {
    const ventaKey = ctx.stub.createCompositeKey(ventaPrefix, [ctx.clientIdentity.getID(), id]);
    const venta = await ctx.stub.getState(ventaKey);
    return venta.toString();
  }

  async getMyVentas(ctx: Context) {
    // venta\u0000ID_USER
    const ventaIterator = await ctx.stub.getStateByPartialCompositeKey(ventaPrefix, [ctx.clientIdentity.getID()]);
    const ventas = [];
    while (true) {
      const venta = await ventaIterator.next();
      if (venta.value && venta.value.value.toString()) {
        let key = ctx.stub.splitCompositeKey(venta.value.key);
        ventas.push({ Key: key.attributes[1], Record: JSON.parse(venta.value.value.toString()) });
      }
      if (venta.done) {
        await ventaIterator.close();
        return JSON.stringify(ventas);
      }
    }
  }


  async limpiarChaincode(ctx) {
    let iterator = await ctx.stub.getStateByPartialCompositeKey(productPrefix, []);

    let result = await iterator.next();
    while (!result.done) {
      await ctx.stub.deleteState(result.value.key);
      result = await iterator.next();
    }

    iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, []);

    result = await iterator.next();
    while (!result.done) {
      await ctx.stub.deleteState(result.value.key);
      result = await iterator.next();
    }

    iterator = await ctx.stub.getStateByPartialCompositeKey(ventaPrefix, []);

    result = await iterator.next();
    while (!result.done) {
      await ctx.stub.deleteState(result.value.key);
      result = await iterator.next();
    }

    return "OK";
  }
}

module.exports = ProductContract;
