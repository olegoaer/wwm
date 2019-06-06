var events = require("events");
var util = require("util");
var url = require("url");
var net = require("net");

function _connect(client, port, hostname){

  client.connect(port, hostname);
  client.setEncoding("utf8");
};

function processingReceiveData(address, clientObj, data){

  var JSONData = JSON.parse(data.toString('utf8'));
  if(JSONData.typeProtocol == "list"){

    var addressPath = address.protocol + "//" + address.host + ((address.pathname != "/") ? address.pathname : "") + "/";
    var dataList = { path : addressPath, models : JSONData.dataProtocol.models, count : JSONData.dataProtocol.count };
    clientObj.emit(JSONData.typeProtocol, dataList);
  }
  else{

    clientObj.emit(JSONData.typeProtocol, JSONData.dataProtocol);
  }
};

var Client = function(){

  events.call(this);
  this._client;

  this.connect = function(address, options){

    var self = this;
    var addressParse = url.parse(address);

    if(addressParse.pathname == null || addressParse.hostname == null || addressParse.port == null || addressParse.protocol !== "model:"){

      self.emit('error', "invalid URL");
    }
    else{

      this._client = net.Socket();
      this._client.setEncoding("utf8");
      this._client.setTimeout(60 * 1000 * 600); // allongement du temps de la socket
      var port = addressParse.port;
      var hostname = addressParse.hostname;
      var data;
      var dataReceive = "";

      if(addressParse.hash == null){

        if(addressParse.query == null){

          data = addressParse.pathname;
        }
        else{

          data = addressParse.pathname + "?" + addressParse.query;
        }
      }
      else{

        data = addressParse.pathname + addressParse.hash;
      }

      _connect(this._client, port, hostname);

      this._client.write(data);
      this._client.write("finDeTransmission_Model");

      this._client.on("data", function(data){

        if(data.substr(data.length - 23) == "finDeTransmission_Model"){

          data = data.substr(0, data.length - 23);
          dataReceive += data;
          processingReceiveData(addressParse, self, dataReceive);
          this.emit("end");
        }
        else {

          dataReceive += data;
        }
      });

      this._client.on("end", function(){

        this.destroy();
      });
    }
  };
};

util.inherits(Client, events);

module.exports = Client;
