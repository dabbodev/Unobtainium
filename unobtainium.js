var fs = require('fs')

class Unobtainium {
    constructor(key) {
        this.key = key
        this.data = null
    }
    triangulate(index, i2, i3) {
            var a = Math.sqrt(Math.pow((this.key.poly[i2][0] - this.key.poly[index][0]), 2) + Math.pow((this.key.poly[i2][1] - this.key.poly[index][1]), 2) + Math.pow((this.key.poly[i2][2] - this.key.poly[index][2]), 2))
            var c = Math.sqrt(Math.pow((this.key.poly[i3][0] - this.key.poly[i2][0]), 2) + Math.pow((this.key.poly[i3][1] - this.key.poly[i2][1]), 2) + Math.pow((this.key.poly[i3][2] - this.key.poly[i2][2]), 2))
            var b = Math.sqrt(Math.pow((this.key.poly[index][0] - this.key.poly[i3][0]), 2) + Math.pow((this.key.poly[index][1] - this.key.poly[i3][1]), 2) + Math.pow((this.key.poly[index][2] - this.key.poly[i3][2]), 2))
            
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
                var e = (d1 + d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 30) {
                var e = (d1 + d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 45) {
                var e = (d1 - d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 60) {
                var e = (d1 - d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 75) {
                var e = (d1 + d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 90) {
                var e = (d1 + d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 105) {
                var e = (d1 - d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else {
                var e = (d1 - d2 + d3) % 15
                console.log(e)
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
                var e = (d1 + d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 30) {
                var e = (d1 + d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 45) {
                var e = (d1 - d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 60) {
                var e = (d1 - d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 75) {
                var e = (d1 + d2 + d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 90) {
                var e = (d1 + d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 105) {
                var e = (d1 - d2 - d3) % 15
                console.log(e)
                this.data[i] = (this.data[i] + e)
            } else {
                var e = (d1 - d2 + d3) % 15
                console.log(e)
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