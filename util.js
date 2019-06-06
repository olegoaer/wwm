var fs = require("fs");

function save(data, fname){

  var filename = (data.name != null) ? data.name : ((fname != null) ? fname : "tmp");
  //fs.writeFileSync(filename, JSON.stringify(data));
  if(typeof data == "string"){

    fs.writeFileSync(filename, data);
  }
  else if(data.content != null){

    fs.writeFileSync(filename, data.content);
  }
  else{

    fs.writeFileSync(filename, JSON.stringify(data));
  }
};

module.exports.save = save;
