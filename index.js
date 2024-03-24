const fs = require('fs')
const path = require('path')
const unobtainium = require('./unobtainium.js')

var yargs = require('yargs').argv
//console.log(yargs)

var ENCRYPT = false
var DECRYPT = false
var en_path = "./encrypt/"
var de_path = "./decrypt/"
var hash_path = "./hash/"
var key = "sample.stl"
var output = "./out/"

class Shell {

  constructor(yargs = null) {
    //Check for Arguments
    if (yargs) {
      //Assign new Key file
      if (yargs.key) {
        key = yargs.key
      }
      
        this.unobtainable = new unobtainium(key)
        this.go()
    }
  }

  go() {
    //Check if getting signature
    if (yargs.gensig) {
      if (typeof(yargs.gensig) == "string") {
        hash_path = yargs.gensig
      }
      //Check if Directory
      if (hash_path[hash_path.length - 1] == "/") {
        fs.readdir(hash_path, (err, files) => {
          if (err) {
            console.error("Could not list the directory.", err);
            process.exit(1);
          }
          files.forEach((file, index) => {
            var fromPath = path.join(hash_path, file);
            console.log(fromPath)
            var contents = Buffer.from(fs.readFileSync(fromPath))
            this.unobtainable.read(contents)
            this.unobtainable.getSignature(yargs.sigpoints ? parseInt(yargs.sigpoints) : 5, yargs.out ? yargs.out : undefined) 
          })
        })
      } else {
        console.log(hash_path)
        var contents = Buffer.from(fs.readFileSync(hash_path))
        this.unobtainable.read(contents)
        this.unobtainable.getSignature(yargs.sigpoints ? parseInt(yargs.sigpoints) : 5, yargs.out ? yargs.out : undefined) 
      } 
    }
    //Check if Encrypting
    if (yargs.encrypt) {
      //Check for Target
      if (typeof(yargs.encrypt) == "string") {
        en_path = yargs.encrypt
      }
      //Check if Directory
      if (en_path[en_path.length - 1] == "/") {
        fs.readdir(en_path, (err, files) => {
          if (err) {
            console.error("Could not list the directory.", err);
            process.exit(1);
          }
          files.forEach((file, index) => {
            var fromPath = path.join(en_path, file);
            console.log(fromPath)
            var contents = Buffer.from(fs.readFileSync(fromPath))
            this.unobtainable.read(contents)
            //Check for Output
            if (yargs.out) {
              //Check if Directory
              output = yargs.out
              if (output[output.length - 1] == "/") {
                this.unobtainable.obscure().then(() => {
                  this.unobtainable.writeTo(output + file + ".un")
                })
              } else {
                throw("Output not a directory when working with a directory input")
              }
              
            } else {
              this.unobtainable.obscure().then(() => {
                this.unobtainable.writeTo(output + file + ".un")
              })
            }
            
          })
        })
      } else {
        console.log(en_path)
        var contents = Buffer.from(fs.readFileSync(en_path))
        this.unobtainable.read(contents)
        //Check for Output
        if (yargs.out) {
          //Check if Directory
          output = yargs.out
          if (output[output.length - 1] == "/") {
            this.unobtainable.obscure().then(() => {
              this.unobtainable.writeTo(output + en_path.substr(en_path.lastIndexOf("/"), en_path.length - en_path.lastIndexOf("/") - 1) + ".un")
            })
          } else {
            this.unobtainable.obscure().then(() => {
              this.unobtainable.writeTo(output)
            })
          }
          
        } else {
          this.unobtainable.obscure().then(() => {
            this.unobtainable.writeTo(output + en_path.substr(en_path.lastIndexOf("/"), en_path.length - en_path.lastIndexOf("/") - 1) + ".un")
          })
        }
      }   
    }
    if (yargs.decrypt) {
      //Check for Target
      if (typeof(yargs.decrypt) == "string") {
        de_path = yargs.decrypt
      }
      //Check if Directory
      if (de_path[de_path.length - 1] == "/") {
        fs.readdir(de_path, (err, files) => {
          if (err) {
            console.error("Could not list the directory.", err);
            process.exit(1);
          }
          files.forEach((file, index) => {
            var fromPath = path.join(de_path, file);
            console.log(fromPath)
            var contents = Buffer.from(fs.readFileSync(fromPath))
            this.unobtainable.read(contents)
            //Check for Output
            if (yargs.out) {
              //Check if Directory
              output = yargs.out
              if (output[output.length - 1] == "/") {
                this.unobtainable.obtain().then(() => {
                  this.unobtainable.writeTo(output + file)
                })
              } else {
                throw("Output not a directory when working with a directory input")
              }
              
            } else {
              this.unobtainable.obtain().then(() => {
                this.unobtainable.writeTo(output + file)
              })
            }
            
          })
        })
      } else {
        console.log(de_path)
        var contents = Buffer.from(fs.readFileSync(de_path))
        this.unobtainable.read(contents)
        //Check for Output
        if (yargs.out) {
          //Check if Directory
          output = yargs.out
          if (output[output.length - 1] == "/") {
            this.unobtainable.obtain().then(() => {
              this.unobtainable.writeTo(output + de_path.substr(de_path.lastIndexOf("/"), de_path.length - de_path.lastIndexOf("/") - 1))
            })
          } else {
            this.unobtainable.obtain().then(() => {
              this.unobtainable.writeTo(output)
            })
          }
          
        } else {
          this.unobtainable.obtain().then(() => {
            this.unobtainable.writeTo(output + de_path.substr(de_path.lastIndexOf("/"), de_path.length - de_path.lastIndexOf("/") - 1))
          })
        }
      }
    }
  }
  init(key) {

    this.unobtainable = new unobtainium()
  }
}

if (yargs) {
  var shell = new Shell(yargs)
}

module.exports = unobtainium