var net = require('net');
var events = require("events");
var util = require("util");
var fs = require("fs");
var request = require('./Request');

var sockets = [];

function directoriesSetup() {

    const _dir_ = './wwm';
    const M3 = _dir_ + '/metametamodel';
    const M2 = _dir_ + '/metamodel';
    const M1 = _dir_ + '/model';

    if (!fs.existsSync(_dir_)){
        fs.mkdirSync(_dir_); fs.mkdirSync(M3); fs.mkdirSync(M2); fs.mkdirSync(M1);
        fs.writeFile(_dir_ + '/readme.txt', 'Welcome to WWM. To start, place your Model files into the suitable directories');
        console.log('Directories structure created');
    } else {
        if (!fs.existsSync(M3) || !fs.existsSync(M2) || !fs.existsSync(M1)){
            console.error('Directories structure corrupted.');
            process.exit(1);
        }
    }
};

function processingReceiveData(server, data){

  var bufferQuery;
  var bufferFragment;
  var bufferPath;

  var metaMetaModel = null;
  var metaModel     = null;
  var model         = null;
  var fragment      = null;
  var query         = null;

  bufferQuery       = data.split("?");
  query             = bufferQuery[1];

  bufferFragment    = bufferQuery[0].split("#");
  fragment          = bufferFragment[1];

  bufferPath        = bufferFragment[0].split("/");
  metaMetaModel     = bufferPath[1];
  if(metaMetaModel == ""){

    metaMetaModel = undefined;
  }
  metaModel         = bufferPath[2];
  model             = bufferPath[3];

  var req = new request();

  req.createRequest(data, metaMetaModel, metaModel, model, fragment, query);
  server.emit("request", req);

  return req;
};

function setData(socket, type, data){

  var protocol = { typeProtocol : type, dataProtocol : data }; // encapsulation protocole JSON
  socket.write(JSON.stringify(protocol));
  socket.write("finDeTransmission_Model"); // permet de définir la fin du message
};

function definePath(modelType, req, extension){

  var path = "./wwm/" + modelType;

  if(extension != null){

    path += "/" + req + "." + extension;
  }

  return path;
};

function defineModelData(req, data){

  var JSONModel = { name : req, content : data };
  return JSONModel;
}

function preparingData(req, files){

  var data;
  var filenameSplit;
  var filenames = [];
  var filename = "";

  for(var i = 0; i < files.length; i++){

    filenameSplit = files[i].split(".");
    if(filenameSplit[filenameSplit.length - 1] == req.toLowerCase() || req == "isQuery"){

      for(var j = 0; j < filenameSplit.length - 1; j++){

        filename += filenameSplit[j];
      }
      filenames.push(filename);
      filename = "";
    }
  }

  data = { models : filenames, count : ("" + filenames.length) };
  return data;
};

function searchFragment(data, fragName){

  var tabFrag = fragName.split(".");
  var fName = "";
  for(var i = 0; i < tabFrag.length - 1; i++){

    fName += tabFrag[i];
  }

  var begin = "wwm-begin(" + fName + ")";
  var fragBegin = data.indexOf(begin);
  var fragEnd = data.indexOf("wwm-end(" + fName + ")");

  data =  data.substr((fragBegin + begin.length), (fragEnd - fragBegin - begin.length));

  data = data.replace(/<!--[^]*-->/g, "");
  data = data.replace(/--[^?!\n]*/g, "");
  data = data.replace(/-->/g, "");
  data = data.replace(/<!/g, "");

  return { name : fragName, content : data };
};

function processingSendData(socket, req){

  if(req.isMetaMetaModel()){    // c'est un metaMetaModel

    if(req.isFragment()){       // c'est un fragment

      if(req.isQuery()){        // c'est un query => erreur

        // erreur : ne peut pas être metaMetaModel ET fragment ET query
        setData(socket, "error", "Error: can't be metaMetaModel AND fragment AND query");
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore#frag1 => retourne le frag1 de Ecore.ecore
        var path = definePath("metametamodel", req._metaMetaModel, req._metaMetaModel.toLowerCase());
        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("metametamodel", req._metaMetaModel, "xmi");
            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                // traitement du fragment
                var nameFrag = req._fragment + ".xmi";
                var fragment = searchFragment(data, nameFrag);
                setData(socket, "fragment", fragment);
              }
            });
          }
          else{

            // traitement du fragment
            var nameFrag = req._fragment + "." + req._metaMetaModel.toLowerCase();
            var fragment = searchFragment(data, nameFrag);
            setData(socket, "fragment", fragment);
          }
        });
      }
    }
    else{                           // ce n'est pas un fragment

      if(req.isQuery()){        // c'est un query

        if(req._query == "info"){ // query info

          // model://localhost:6464/Ecore?info => retourne le nfo de Ecore.ecore soit Ecore.nfo
          var pathTest = definePath("metametamodel", req._metaMetaModel, req._metaMetaModel.toLowerCase());
          var pathTestXMI = definePath("metametamodel", req._metaMetaModel, "xmi");
          if(fs.existsSync(pathTest) || fs.existsSync(pathTestXMI)){

            var path = definePath("metametamodel", req._metaMetaModel, "nfo");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                setData(socket, "info", data);
              }
            });
          }
          else{

            // fichier absent ou endommagé => retourne une erreur
            setData(socket, "error", "Error: absent or damaged file");
          }
        }
        else if(req._query == "list"){ // query list

          // model://localhost:6464/Ecore?list => retourne le JSON indiquant les fichiers .ecore présents dans le dossier metaModel
          var path = definePath("metamodel");

          fs.readdir(path, function(err, files){

            if(err != null){

              // dossier absent ou endommagé => retourne erreur
              setData(socket, "error", "Error: absent or damaged repertory");
            }
            else{

              var dataP = preparingData(req._metaMetaModel, files);
              setData(socket, "list", dataP);
            }
          });
        }
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore => retourne le fichier Ecore.ecore
        var path = definePath("metametamodel", req._metaMetaModel, req._metaMetaModel.toLowerCase());

        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("metametamodel", req._metaMetaModel, "xmi");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                var nameModel = req._metaMetaModel + ".xmi";
                var model = defineModelData(nameModel, data);
                setData(socket, "model", model);
              }
            });
          }
          else{

            var nameModel = req._metaMetaModel + "." + req._metaMetaModel.toLowerCase();
            var model = defineModelData(nameModel, data);
            setData(socket, "model", model);
          }
        });
      }
    }
  }
  else if(req.isMetaModel()){

    if(req.isFragment()){       // c'est un fragment

      if(req.isQuery()){        // c'est un query => erreur

        // erreur : ne peut pas être metaModel ET fragment ET query
        setData(socket, "error", "Error: can't be metaModel AND fragment AND query");
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore/UML#frag1 => retourne le frag1 de UML.ecore
        var path = definePath("metamodel", req._metaModel, req._metaMetaModel.toLowerCase());
        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("metamodel", req._metaModel, "xmi");
            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                // traitement du fragment
                var nameFrag = req._fragment + ".xmi";
                var fragment = searchFragment(data, nameFrag);
                setData(socket, "fragment", fragment);
              }
            });
          }
          else{

            // traitement du fragment
            var nameFrag = req._fragment + "." + req._metaMetaModel.toLowerCase();
            var fragment = searchFragment(data, nameFrag);
            setData(socket, "fragment", fragment);
            // var fragment = searchFragment(data, req._fragment);
            // setData(socket, "fragment", fragment);
          }
        });
      }
    }
    else{                           // ce n'est pas un fragment

      if(req.isQuery()){        // c'est un query

        if(req._query == "info"){ // query info

          // model://localhost:6464/Ecore/UML?info => retourne le nfo de UML.ecore soit UML.nfo
          var pathTest = definePath("metamodel", req._metaModel, req._metaMetaModel.toLowerCase());
          var pathTestXMI = definePath("metamodel", req._metaModel, "xmi");
          if(fs.existsSync(pathTest) || fs.existsSync(pathTestXMI)){

            var path = definePath("metamodel", req._metaModel, "nfo");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                setData(socket, "info", data);
              }
            });
          }
          else{

            // fichier absent ou endommagé => retourne une erreur
            setData(socket, "error", "Error: absent or damaged file");
          }
        }
        else if(req._query == "list"){ // query list

          // model://localhost:6464/Ecore/UML?list => retourne le JSON indiquant les fichiers .uml présents dans le dossier model
          var path = definePath("model");

          fs.readdir(path, function(err, files){

            if(err != null){

              // dossier absent ou endommagé => retourne erreur
              setData(socket, "error", "Error: absent or damaged repertory");
            }
            else{

              var dataP = preparingData(req._metaModel, files);
              setData(socket, "list", dataP);
            }
          });
        }
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore/UML => retourne le fichier UML.ecore
        var path = definePath("metamodel", req._metaModel, req._metaMetaModel.toLowerCase());

        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("metamodel", req._metaModel, "xmi");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                var nameModel = req._metaModel + ".xmi";
                var model = defineModelData(nameModel, data);
                setData(socket, "model", model);
                // var model = defineModelData(req._metaModel, data);
                // setData(socket, "model", model);
              }
            });
          }
          else{

            var nameModel = req._metaModel + "." + req._metaMetaModel.toLowerCase();
            var model = defineModelData(nameModel, data);
            setData(socket, "model", model);
            // var model = defineModelData(req._metaModel, data);
            // setData(socket, "model", model);
          }
        });
      }
    }
  }
  else if(req.isModel()){

    if(req.isFragment()){       // c'est un fragment

      if(req.isQuery()){        // c'est un query => erreur

        // erreur : ne peut pas être model ET fragment ET query
        setData(socket, "error", "Error: can't be model AND fragment AND query");
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore/UML/thermostat#frag1 => retourne le frag1 de thermostat.uml
        var path = definePath("model", req._model, req._metaModel.toLowerCase());
        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("model", req._model, "xmi");
            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                // traitement du fragment
                var nameFrag = req._fragment + ".xmi";
                var fragment = searchFragment(data, nameFrag);
                setData(socket, "fragment", fragment);
              }
            });
          }
          else{

            // traitement du fragment
            var nameFrag = req._fragment + "." + req._metaModel.toLowerCase();
            var fragment = searchFragment(data, nameFrag);
            setData(socket, "fragment", fragment);
            // var fragment = searchFragment(data, req._fragment);
            // setData(socket, "fragment", fragment);
          }
        });
      }
    }
    else{                           // ce n'est pas un fragment

      if(req.isQuery()){        // c'est un query

        if(req._query == "info"){ // query info

          // model://localhost:6464/Ecore/UML/thermostat?info => retourne le nfo de thermostat.uml soit thermostat.nfo
          var pathTest = definePath("model", req._model, req._metaModel.toLowerCase());
          var pathTestXMI = definePath("model", req._model, "xmi");
          if(fs.existsSync(pathTest) || fs.existsSync(pathTestXMI)){

            var path = definePath("model", req._model, "nfo");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                setData(socket, "info", data);
              }
            });
          }
          else{

            // fichier absent ou endommagé => retourne une erreur
            setData(socket, "error", "Error: absent or damaged file");
          }
        }
        else if(req._query == "list"){ // query list => erreur OU retourne la list des fragments de thermostat.uml...

          // model://localhost:6464/Ecore/UML/thermostat?list => erreur OU retourne le JSON indiquant les fragments présents dans le fichier thermostat.uml...
          setData(socket, "error", "Error: There is no file with extension ." + req._model);
        }
      }
      else{                         // ce n'est pas un query

        // model://localhost:6464/Ecore/UML/thermostat => retourne le fichier thermostat.uml
        var path = definePath("model", req._model, req._metaModel.toLowerCase());

        fs.readFile(path, {encoding : "utf8"}, function(err, data){

          if(err != null){

            path = definePath("model", req._model, "xmi");

            fs.readFile(path, {encoding : "utf8"}, function(err, data){

              if(err != null){

                // fichier absent ou endommagé => retourne une erreur
                setData(socket, "error", "Error: absent or damaged file");
              }
              else{

                var nameModel = req._model + ".xmi";
                var model = defineModelData(nameModel, data);
                setData(socket, "model", model);
                // var model = defineModelData(req._model, data);
                // setData(socket, "model", model);
              }
            });
          }
          else{

            var nameModel = req._model + "." + req._metaModel.toLowerCase();
            var model = defineModelData(nameModel, data);
            setData(socket, "model", model);
            // var model = defineModelData(req._model, data);
            // setData(socket, "model", model);
          }
        });
      }
    }
  }
  else if(req.isQuery()){

    if(req._query == "list"){

      // model://localhost:6464/?list => retourne la list de tous les fichiers présents dans le dossier metaMetaModel
      var path = definePath("metametamodel");

      fs.readdir(path, function(err, files){

        if(err != null){

          // dossier absent ou endommagé => retourne erreur
          setData(socket, "error", "Error: absent or damaged repertory");
        }
        else{

          var dataP = preparingData("isQuery", files);
          setData(socket, "list", dataP);
        }
      });
    }
    else{

      // erreur: pas de query après localhost:6464
      setData(socket, "error", "Error: No query possible after hostname");
    }
  }
  else{

    // erreur: tout autre type d'url est invalide => la demande ne peut aboutir
    return setData("error", "Error: The request can't be completed because it contains errors");
  }
};

var Server = function(){

  events.call(this);
  this._server;

  this.createServer = function(hostname, port){

    this._server = net.createServer(function(socket){

      var dataReceive = "";

      socket.setTimeout(1000 * 60 * 600); // allongement du temps de la socket
      sockets.push(socket);

      socket.on("data", function(data){

        data = data.toString('utf8');
        if(data.substr(data.length - 23) == "finDeTransmission_Model"){

          data = data.substr(0, data.length - 23);
          dataReceive += data;
          var req = processingReceiveData(this._server, dataReceive);
          processingSendData(socket, req);
        }
        else {

          dataReceive += data;
        }
      });

      socket.on("error", function(){

        socket.emit("end");
      });

      socket.on("end", function(){

        sockets.splice(sockets.indexOf(socket), 1);
      });
    });

    this._server.listen(port, hostname, function(){

      directoriesSetup();
    });
  };
};

util.inherits(Server, events);

module.exports =  Server;
