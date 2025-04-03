const Invoice = require("./models/Invoice");
const Ticket = require("./models/Ticket");
const Transcript = require("./models/Transcript");
const User = require("./models/User");

module.exports = class MongoData {
  constructor(client, schema) {
    this.client = client;
    this.schema = schema;
  }

  async all() {
    return await this.schema.find({  }).lean();
  }

  async get(id) {
    const onlyId = id.split(".")[0];

    if(this.schema == User) {
      if(this.client.usersCache.has(onlyId))
        return id.split(".").length > 1 ? this.client.usersCache.get(onlyId)[id.split(".")[1]] : this.client.usersCache.get(onlyId);
    } else if(this.schema == Ticket) {
      if(this.client.ticketsCache.has(onlyId))
        return id.split(".").length > 1 ? this.client.ticketsCache.get(onlyId)[id.split(".")[1]] : this.client.ticketsCache.get(onlyId);
    } else if(this.schema == Transcript) {
      if(this.client.transcriptsCache.has(onlyId))
        return id.split(".").length > 1 ? this.client.transcriptsCache.get(onlyId)[id.split(".")[1]] : this.client.transcriptsCache.get(onlyId);  
    } else if(this.schema == Invoice) {
      if(this.client.invoicesCache.has(onlyId))
        return id.split(".").length > 1 ? this.client.invoicesCache.get(onlyId)[id.split(".")[1]] : this.client.invoicesCache.get(onlyId);  
    }

    const resultData = await this.schema.findOne({ id: onlyId }).lean();

    if(resultData == null && this.schema == User) {
      const newDataCreate = await this.createDefault(onlyId);

      this.client.usersCache.set(onlyId, newDataCreate);
      return newDataCreate;
    }

    this.updateCache(onlyId, resultData);
    
    return id.split(".").length > 1 && resultData ? resultData[id.split(".")[1]] : resultData;
  }

  set(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, id.split(".").length > 1 ? {
      $set: {
        [`${id.split(".").slice(1).join(".")}`]: value
      }
    } : value, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  add(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, {
      $inc: {
        [`${id.split(".").slice(1).join(".")}`]: value
      }
    }, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  sub(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, {
      $inc: {
        [`${id.split(".").slice(1).join(".")}`]: -value
      }
    }, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  delete(id) {
    const onlyId = id.split(".")[0];
    if(id.split(".").length > 1) {
      this.schema.findOneAndUpdate({ id: onlyId }, {
        $unset: {
          [`${id.split(".").slice(1).join(".")}`]: 1
        }
      }, { new: true, upsert: true }).then((post) => {
        this.updateCache(onlyId, post);
      });
    } else {
      this.schema.findOneAndDelete({ id: id }).then((post) => {
        this.updateCache(onlyId, null, "delete");
      });
    }
  }

  push(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, {
      $push: {
        [`${id.split(".").slice(1).join(".")}`]: value
      }
    }, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  pull(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, {
      $pull: {
        [`${id.split(".").slice(1).join(".")}`]: value
      }
    }, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  unshift(id, value) {
    const onlyId = id.split(".")[0];
    this.schema.findOneAndUpdate({ id: onlyId }, {
      $unshift: {
        [`${id.split(".").slice(1).join(".")}`]: value
      }
    }, { new: true, upsert: true }).then((post) => {
      this.updateCache(onlyId, post);
    });
  }

  async createDefault(id) {
    const onlyId = id.split(".")[0];
    const createData = await this.schema.create({ id: onlyId });

    this.updateCache(onlyId, createData);
    return createData;
  }

  updateCache(id, data, action = "update") {
    if(data != null && action == "update") {
      if(this.schema == User) {
        delete data["_id"];
        this.client.usersCache.set(id, data);
      } else if(this.schema == Ticket) {
        delete data["_id"];
        this.client.ticketsCache.set(id, data); 
      } else if(this.schema == Transcript) {
        delete data["_id"];
        this.client.transcriptsCache.set(id, data); 
      } else if(this.schema == Invoice) {
        delete data["_id"];
        this.client.invoicesCache.set(id, data); 
      }
    } else if(action == "delete") {
      if(this.schema == User) {
        this.client.usersCache.delete(id);
      } else if(this.schema == Ticket) {
        this.client.ticketsCache.delete(id); 
      } else if(this.schema == Transcript) {
        this.client.transcriptsCache.delete(id);
      } else if(this.schema == Invoice) {
        this.client.invoicesCache.delete(id);
      }
    }
  }
}
