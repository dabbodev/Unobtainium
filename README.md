Unobtainium uses 3-dimensional polygonal greometry to encrypt your data

Currently implemented CLI file encrypting
Currently working on package usage to encrypt any buffer within nodejs

How to use it:
npm install unobtainium-enc

then cd to its folder or install it globally to call from the CLI

Arguemnts:
--encrypt [PATH]

Sets the directory or file to encrypt, if a directory is chosen it will run through every file in the directory. The default value for this arguments is ./encrypt/

--decrypt [PATH]
Sets the directory or file to decrypt, if a directory is chosen it will run through every file in the directory. The default value for this arguments is ./decrypt/

--out [PATH]
Sets the output of the file to be saved. By default this argument is set to './out/' and appends .un to the file name if encrypting

--key [PATH]
Sets the path to the encryption key. Currently accepts any .stl file or a JSON file containing an object where the key "poly" contains an array of 3-dimensional points 