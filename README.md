This is Unobtainium, it's a weird little encryption algorithm I wrote for fun.I called it Unobtainium
mostly because I thought it was a funny name for it but here's a basic rundown of the idea:
So basically what it does is it takes a matrix of n*3 size, in the form of a list of 3-dimensional
numbers, and then creates a shift mask for any set of hex data, by iterating over each hex
character and shifting it according to instructions derived from the matrix. Basically at each step
it aligns 3 possible points, and then chooses a method of combining the x, y, and z point values
based on the central angle of a line drawn between the three points.

Live Encryptor Demo: https://undemo-encryptor.web.app/

Visual Demo: https://undemo-builder.web.app/

Visual Demo Instructions:
1) Fill the list on the left with at least 3 or more (You will see 1, 2, 3 under #) points of data, using
non-negative numbers. (Or use the I'm Feelin Lucky button to add a random point)
2) Click import to add a file from your device to the demo. This does not upload anything; it
simply grabs the first chunk of hex data that represents that file to display on the page.
3) Click generate mask to generate an example of what the shift mask looks like when using the
points you've added to the list on the left
4) Click Up to shift the data Up using the mask (it is now encrypted)
5) Click copy to copy the output back to the input
6) Click Down to shift the data Down using the mask (it is now unencrypted)

Unobtainium now supports being imported as a package!

to use unobtainium simply install it from npm using "npm install unobtainium-enc" and import it into your project 

```javascript
const unobtainium = require('unobtainium-enc')
```

to create a new instance of it to use in your project you will need to create a new encryptor object:

```javascript
var encryptor = new unobtainium(key, options)
```

the constructor for the object takes 2 variables, key and options.

for the key parameter, you must provide one of the following: a string path to a .stl file (3D model), a string path to a .json file containing a json object where the key "poly" is an array of 3D points, or a javascript object where the key "poly" is an array of 3D points

The options paramater is optional, but accepts an object containing the following possible options:

keepPosition: default - false, if set to true the encryptor will retain it's position in the mask between obscuring/obtaining actions, this option is only best suited to live communications as it allows the continuous use of a large masking set over many small masking operations adding an extra layer of obfuscation. Not suited for masking files, as the starting position must then be remembered for proper unmasking

floor: default - 0, under normal circumstances, unobtainium allows for a possible discrepancy of 0 in it's cipher mask, meaning that it is sometimes possible that a hex character in the set is actually the original unciphered character. if you set this to 1, it will boost each cipher character by 1, eliminating any possible original data from coming through

point, shift, and gap: default - 0, these are the internal positional trackers unobtainium uses to define where it is currently reading from in the key. You can access these values by calling encryptor.point etc, and if you need to store those positions for later use, you can start an instance of the encryptor at that position by setting these options at creation


to use unobtainium, simply place an ArrayBuffer of data into it's memory by calling

```javascript
encryptor.read(data)
```

to encrypt the data in unobtainium's memory, we can shift the sequence up by 1 mask factor by calling

```javascript
encryptor.obscure()
```

you can await this in async mode or use .then() to operate after the action, and the obscured data can be obtained from 

```javascript
encryptor.data
```

to decrypt the data in unobtainium's memory, we can shift the sequence down by 1 mask factor by calling

```javascript
encryptor.obtain()
```

you can await this in async mode or use .then() to operate after the action, and the data can be obtained from encryptor.data

you can also have unobtainium write the currently stored data to the disk by calling

```javascript
encryptor.writeTo(filename)
```

unobtainium also functions from the CLI for basic file use

Arguments:
--encrypt [PATH]

Sets the directory or file to encrypt, if a directory is chosen it will run through every file in the directory. The default value for this argument is ./encrypt/

--decrypt [PATH]
Sets the directory or file to decrypt, if a directory is chosen it will run through every file in the directory. The default value for this argument is ./decrypt/

--out [PATH]
Sets the output of the file to be saved. By default this argument is set to './out/' and appends .un to the file name if encrypting

--key [PATH]
Sets the path to the encryption key. Currently accepts any .stl file or a JSON file containing an object where the key "poly" contains an array of 3-dimensional points 
