var fs = require('fs')
stljs = require('stljs')

class Unobtainium {
    constructor(key = {poly: []}) {
        this.key = key
        this.data = null
    }
    consume(atlfile) {
        return new Promise((resolve, reject) => {
            stljs.readFile(atlfile, (err, solid, name) => {
                //console.log(solid)
                var newkey = {poly: []}
                solid.forEach((poly) => {
                    poly.verticies.forEach((point) => {
                        newkey.poly.push(point)
                    })
                })
                //console.log(newkey)
                this.key = newkey
                resolve()
            }
            , (err, polygon, name) => {
          //console.log(polygon)     
            }

        )
        })        

    }
    triangulate(index, i2, i3) {
            var a = 0
            for (var i = 0; i < this.key.poly[index].length; i++) {
                a += Math.pow((this.key.poly[i2][i] - this.key.poly[index][i]), 2)
            }
            a = Math.sqrt(a)

            var b = 0
            for (var i = 0; i < this.key.poly[index].length; i++) {
                b += Math.pow((this.key.poly[index][i] - this.key.poly[i3][i]), 2)
            }
            b = Math.sqrt(b)

            var c = 0
            for (var i = 0; i < this.key.poly[index].length; i++) {
                c += Math.pow((this.key.poly[i3][i] - this.key.poly[i2][i]), 2)
            }
            c = Math.sqrt(c)

            var cosC = (Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b)
            var pi = Math.PI
            var deg = Math.acos(cosC) * (180/pi)

            return deg
    }
    read(data) {
        this.data = data
    }
    obscure() { return new Promise((resolve, reject) => {
        var point = 0
        var shift = 0
        var gap = 0
        for (var i = 0; i < this.data.length; i++) {
            var point2 = ((point + shift + 1) % this.key.poly.length)
            var point3 = ((point + shift + gap + 2) % this.key.poly.length)

            //console.log(point, point2, point3, this.key.poly.length)
            var angle = this.triangulate(point, point2, point3)
            var d1 = this.key.poly[point][0]
            var d2 = this.key.poly[point][1]
            var d3 = this.key.poly[point][2]

            
            if (angle < 15) {
                var e = Math.floor((d1 + d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 30) {
                var e = Math.floor((d1 + d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 45) {
                var e = Math.floor((d1 - d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 60) {
                var e = Math.floor((d1 - d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 75) {
                var e = Math.ceil((d1 + d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 90) {
                var e = Math.ceil((d1 + d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 105) {
                var e = Math.ceil((d1 - d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else {
                var e = Math.ceil((d1 - d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            }
            if (point == (this.key.poly.length - 1)) {
                if (shift == (this.key.poly.length - 1)) {
                    gap = ((gap + 1) % this.key.poly.length)
                }
                shift = ((shift + 1) % this.key.poly.length)
            }
            point = ((point + 1) % this.key.poly.length)
        }
        resolve()
    })
    }   
    obtain() { return new Promise((resolve, reject) => {
        var point = 0
        var shift = 0
        var gap = 0
        for (var i = 0; i < this.data.length; i++) {
            var point2 = ((point + shift + 1) % this.key.poly.length)
            var point3 = ((point + shift + gap + 2) % this.key.poly.length)

            //console.log(point, point2, point3, this.key.poly.length)
            var angle = this.triangulate(point, point2, point3)
            var d1 = this.key.poly[point][0]
            var d2 = this.key.poly[point][1]
            var d3 = this.key.poly[point][2]

            
            if (angle < 15) {
                var e = Math.floor((d1 + d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 30) {
                var e = Math.floor((d1 + d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 45) {
                var e = Math.floor((d1 - d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 60) {
                var e = Math.floor((d1 - d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 75) {
                var e = Math.ceil((d1 + d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 90) {
                var e = Math.ceil((d1 + d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 105) {
                var e = Math.ceil((d1 - d2 - d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else {
                var e = Math.ceil((d1 - d2 + d3)) % 15
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            }
            if (point == (this.key.poly.length - 1)) {
                if (shift == (this.key.poly.length - 1)) {
                    gap = ((gap + 1) % this.key.poly.length)
                }
                shift = ((shift + 1) % this.key.poly.length)
            }
            point = ((point + 1) % this.key.poly.length)
        }
        resolve()
    })
    }
    writeTo(file) {
        fs.writeFile(file, this.data,  "binary",function(err) {
            if(err) {
                console.log(err);
            } else {
                console.log("The file was saved!");
            }
        });
    }
}

module.exports = Unobtainium