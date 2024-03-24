var fs = require('fs')

class Unobtainium {
    constructor(keyfile, options={point: 0, shift:0, gap: 0, keepPosition: false, floor: 0}) {
        this.key = {poly: []}
        if (keyfile.constructor.name == 'String') {
            var filename = keyfile.split(/(\\|\/)/g).pop()
            var ex = filename.substr(filename.length - 4).toLowerCase()
            if (ex == ".stl") {
                this.consume(keyfile)
            } else if (ex == "son") {
                this.key = require(keyfile)
            }
        } else if (keyfile.constructor.name == "Object") {
            this.key = keyfile
        }
        this.data = null
        this.point = options.point ? options.point : 0
        this.shift = options.shift ? options.shift : 0
        this.gap = options.gap ? options.gap : 0
        this.keepPosition = options.keepPosition ? options.keepPosition : false
        this.floor = options.floor ? options.floor : 0
    }
    async getSignature(maxPoints=5, outputFile=undefined) {
        var sig = ''
        var tempKey = []
        for (var i = 0; i < maxPoints; i++) {
            tempKey.push([0.0, 0.0, 0.0])
        }
        //Create key
        var i = 0
        var j = 0
        var k = 0
        var mod = '+'
        console.log(this.data.length)
        while (i < this.data.length) {
            //console.log([i, j, k, mod, tempKey[j][k], this.data[i]])
            mod == '+' ? tempKey[j][k] += new Number(this.data[i])/10 : tempKey[j][k] -= new Number(this.data[i])/10
            k = (k+1) % 3
            if (k == 0) j = (j+1) % maxPoints
            if (j == 0 && k == 0) mod == '+' ? mod = '-' : mod = '+'
            i++
        }

        //console.log(tempKey)

        var smallestX = 0
        var smallestY = 0
        var smallestZ = 0
        for (var i = 0; i < tempKey.length; i++) {
            var [x, y, z] = tempKey[i]
            if (x < smallestX) smallestX = x
            if (y < smallestY) smallestY = y
            if (z < smallestZ) smallestZ = z
        }

        if (smallestX < 0 || smallestY < 0 || smallestZ < 0) {
            for (var i = 0; i < tempKey.length; i++) {
                if (smallestX < 0) tempKey[i][0] += Math.abs(smallestX)
                if (smallestY < 0) tempKey[i][1] += Math.abs(smallestY)
                if (smallestZ < 0) tempKey[i][2] += Math.abs(smallestZ)
            }
        }
        console.log("KEY GENERATED:")
        console.log(tempKey)
        console.log("GENERATING MASK")
        //Generate Mask
        this.point = 0
        this.shift = 0
        this.gap = 0
        do {
            var point1 = this.point
            var point2 = ((this.point + this.shift + 1) % tempKey.length)
            var point3 = ((this.point + this.shift + this.gap + 2) % tempKey.length)

            

            //Triangulate
            var a = 0
            var b = 0
            var c = 0
            for (var i = 0; i < 3; i++) {
                a += Math.pow((tempKey[point2][i] - tempKey[point1][i]), 2)
                b += Math.pow((tempKey[point1][i] - tempKey[point3][i]), 2)
                c += Math.pow((tempKey[point3][i] - tempKey[point2][i]), 2)
            }

            a = Math.sqrt(a)
            b = Math.sqrt(b)
            c = Math.sqrt(c)

            var cosC = (Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b)
            var pi = Math.PI
            var angle = Math.acos(cosC) * (180/pi)

            var d1 = tempKey[point1][0]
            var d2 = tempKey[point1][1]
            var d3 = tempKey[point1][2]
            var e = 0

            if (angle < 15) {
                e = (Math.floor((d1 + d2 + d3)) % (15 - this.floor)) + this.floor
            } else if (angle < 30) {
                e = (Math.floor((d1 + d2 - d3)) % (15 - this.floor)) + this.floor
            } else if (angle < 45) {
                e = (Math.floor((d1 - d2 - d3)) % (15 - this.floor)) + this.floor
            } else if (angle < 60) {
                e = (Math.floor((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
            } else if (angle < 75) {
                e = (Math.ceil((d1 + d2 + d3)) % (15 - this.floor)) + this.floor
            } else if (angle < 90) {
                e = (Math.ceil((d1 + d2 - d3)) % (15 - this.floor)) + this.floor
            } else if (angle < 105) {
                e = (Math.ceil((d1 - d2 - d3)) % (15 - this.floor)) + this.floor
            } else {
                e = (Math.ceil((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
            }

            e >= 0 ? sig += '+' + String(e) : sig += String(e)

            this.point = ((this.point + 1) % tempKey.length)
            if (this.point == 0) this.shift = ((this.shift + 1) % tempKey.length - 1)
            if (this.point == 0 && this.shift == 0) this.gap = ((this.gap + 1) % (tempKey.length - 2))

            //console.log([this.point, this.shift, this.gap])
        } while (this.point != 0 || this.shift != 0 || this.gap != 0)

        sig = 'BEGIN UN-' + maxPoints + ' MASK:\n' + sig 

        if (outputFile) {
            fs.writeFileSync(outputFile, sig)
        }
        
        console.log(sig)
    }
    async consume(keyfile) {
        this.key.poly = []
        var stl = fs.readFileSync(keyfile, null).buffer
        var dv = new DataView(stl, 80);
        var isLittleEndian = true;

        // Read a 32 bit unsigned integer
        var triangles = dv.getUint32(0, isLittleEndian);

        var offset = 4;
        var smallestX = 0
        var smallestY = 0
        var smallestZ = 0
        for (var i = 0; i < triangles; i++) {
            offset += 12;

            for (var j = 0; j < 3; j++) {
                var [x, y, z] = [dv.getFloat32(offset, isLittleEndian),dv.getFloat32(offset+4, isLittleEndian),dv.getFloat32(offset+8, isLittleEndian)]
                if (x < smallestX) smallestX = x
                if (y < smallestY) smallestY = y
                if (z < smallestZ) smallestZ = z
                this.key.poly.push([x, y, z])
                offset += 12
            }
            offset += 2;
        }
        //console.log(smallestX, smallestY, smallestZ)
        if (smallestX < 0 || smallestY < 0 || smallestZ < 0) {
        for (var i = 0; i < this.key.poly.length; i++) {
            if (smallestX < 0) this.key.poly[i][0] += Math.abs(smallestX)
            if (smallestY < 0) this.key.poly[i][1] += Math.abs(smallestY)
            if (smallestZ < 0) this.key.poly[i][2] += Math.abs(smallestZ)
        }
        }      
        return
    }
    triangulate(index, i2, i3) {
            var a = 0
            var b = 0
            var c = 0

            for (var i = 0; i < this.key.poly[index].length; i++) {
                a += Math.pow((this.key.poly[i2][i] - this.key.poly[index][i]), 2)
                b += Math.pow((this.key.poly[index][i] - this.key.poly[i3][i]), 2)
                c += Math.pow((this.key.poly[i3][i] - this.key.poly[i2][i]), 2)
            }

            a = Math.sqrt(a)
            b = Math.sqrt(b)
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
        for (var i = 0; i < this.data.length; i++) {
            var point2 = ((this.point + this.shift + 1) % this.key.poly.length)
            var point3 = ((this.point + this.shift + this.gap + 2) % this.key.poly.length)

            //console.log(point, point2, point3, this.key.poly.length)
            var angle = this.triangulate(this.point, point2, point3)
            var d1 = this.key.poly[this.point][0]
            var d2 = this.key.poly[this.point][1]
            var d3 = this.key.poly[this.point][2]

            
            if (angle < 15) {
                var e = (Math.floor((d1 + d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 30) {
                var e = (Math.floor((d1 + d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 45) {
                var e = (Math.floor((d1 - d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 60) {
                var e = (Math.floor((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 75) {
                var e = (Math.ceil((d1 + d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 90) {
                var e = (Math.ceil((d1 + d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 105) {
                var e = (Math.ceil((d1 - d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else {
                var e = (Math.ceil((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            }
            if (this.point == (this.key.poly.length - 1)) {
                if (this.shift == (this.key.poly.length - 2)) {
                    this.gap = ((this.gap + 1) % (this.key.poly.length - 2))
                }
                this.shift = ((this.shift + 1) % (this.key.poly.length - 1))
            }
            this.point = ((this.point + 1) % this.key.poly.length)
        }
        if (!this.keepPosition) {
            this.point = 0
            this.shift = 0
            this.gap = 0
        }
        resolve()
    })
    }   
    obtain() { return new Promise((resolve, reject) => {
        for (var i = 0; i < this.data.length; i++) {
            var point2 = ((this.point + this.shift + 1) % this.key.poly.length)
            var point3 = ((this.point + this.shift + this.gap + 2) % this.key.poly.length)

            //console.log(point, point2, point3, this.key.poly.length)
            var angle = this.triangulate(this.point, point2, point3)
            var d1 = this.key.poly[this.point][0]
            var d2 = this.key.poly[this.point][1]
            var d3 = this.key.poly[this.point][2]

            
            if (angle < 15) {
                var e = (Math.floor((d1 + d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 30) {
                var e = (Math.floor((d1 + d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 45) {
                var e = (Math.floor((d1 - d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 60) {
                var e = (Math.floor((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] - e)
            } else if (angle < 75) {
                var e = (Math.ceil((d1 + d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 90) {
                var e = (Math.ceil((d1 + d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else if (angle < 105) {
                var e = (Math.ceil((d1 - d2 - d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            } else {
                var e = (Math.ceil((d1 - d2 + d3)) % (15 - this.floor)) + this.floor 
                //console.log(e)
                this.data[i] = (this.data[i] + e)
            }
            if (this.point == (this.key.poly.length - 1)) {
                if (this.shift == (this.key.poly.length - 2)) {
                    this.gap = ((this.gap + 1) % (this.key.poly.length - 2))
                }
                this.shift = ((this.shift + 1) % (this.key.poly.length - 1))
            }
            this.point = ((this.point + 1) % this.key.poly.length)
        }
        if (!this.keepPosition) {
            this.point = 0
            this.shift = 0
            this.gap = 0
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