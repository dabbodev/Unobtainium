var fs = require('fs')
var path = require('path')
var unobtainium = require('./unobtainium.js')
var sample_model = require('./sample_model.json')

var unobtainable = new unobtainium(sample_model)

var ENCRYPT = false
var DECRYPT = true

var en_path = "./encrypt"
var de_path = "./decrypt"

if (ENCRYPT == true) {

fs.readdir(en_path, function (err, files) {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
  
    files.forEach(function (file, index) {
      // Make one pass and make the file complete
      var fromPath = path.join(en_path, file);

      console.log(fromPath)

      
        var contents = Buffer.from(fs.readFileSync(fromPath))
        unobtainable.read(contents)
        console.log(contents)
        unobtainable.obscure().then(() => {
            unobtainable.writeTo("./out/" + file + ".un")
        });

    
    });
  });

}

if (DECRYPT == true) {
    fs.readdir(de_path, function (err, files) {
        if (err) {
          console.error("Could not list the directory.", err);
          process.exit(1);
        }
      
        files.forEach(function (file, index) {
          // Make one pass and make the file complete
          var fromPath = path.join(de_path, file);
    
          
            var contents = Buffer.from(fs.readFileSync(fromPath))
            unobtainable.read(contents)
            console.log(contents)
            unobtainable.obtain().then(() => {
                unobtainable.writeTo("./out/" + file)
            });
    
        
        });
      });
}