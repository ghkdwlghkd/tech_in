# pdf-to-html - pdf2htmlEx shell wrapper for Node.js

## This is a customized package with more functionality inherited from https://github.com/alanhk89/pdftohtml

## Thanks to [@alanhk89](https://github.com/alanh)

pdftohtml provides access to [pdf2htmlEX](https://github.com/coolwanglu/pdf2htmlEX) via shell in node.js programs.

## Requirements

- [pdf2htmlEX](https://github.com/coolwanglu/pdf2htmlEX)

## Quick Setup
1. Create a directory for you node js app
2. Do `` npm init -y ``
2. crate app.js in that directory
3. Download https://drive.google.com/drive/folders/10ar12wziNA76tGf0KaSLV_DCcljX8ORs?usp=sharing
4. Extract the downloaded zip file and copy **pdf2htmlEX.exe** and **data** folder. Paste those 2 thing to your node js app directory.
5. Do `` npm i @dsardar099/pdf-to-html ``
6. You are ready to go for writing code to convert PDF files to HTML files.

**See documentation example for more information.**

If you've docker env setup, just install it via docker

```
alias pdf2htmlEX="docker run -ti --rm -v ~/pdf:/pdf iapain/pdf2htmlex pdf2htmlEX"
```

~/pdf on host computer will be used as volume

## Installation

via yarn:

```
yarn add @dsardar099/pdf-to-html
```

via npm:

```
npm install @dsardar099/pdf-to-html
```

## Usage

```javascript
var pdftohtml = require("@dsardar099/pdf-to-html");
var converter = new pdftohtml("test/pdfs/sample.pdf", "sample.html");

// See presets (ipad, default)
// Feel free to create custom presets
// see https://github.com/alanhk89/pdftohtml/blob/master/lib/presets/ipad.js
// convert() returns promise
converter
  .convert("ipad")
  .then(function () {
    console.log("Success");
  })
  .catch(function (err) {
    console.error("Conversion error: " + err);
  });

// If you would like to disable printing of the converted html output,
// just call converter.disablePrinting()
converter
  .convert()
  .then(function () {
    converter.disablePrinting();
    console.log("Success");
  })
  .catch(function (err) {
    console.error("Conversion error: " + err);
  });

// If you would like to enable enableContentEditable of the converted html output,
// just call converter.enableContentEditable()
converter
  .convert()
  .then(function () {
    converter.enableContentEditable();
    console.log("Success");
  })
  .catch(function (err) {
    console.error("Conversion error: " + err);
  });

// If you would like to tap into progress then create
// progress handler
converter.progress(function (ret) {
  console.log((ret.current * 100.0) / ret.total + " %");
});
```

## Command line usage

```
yarn global add @dsardar099/pdf-to-html
```

```
@dsardar099/pdf-to-html sample.pdf
```

You may optionally provide your own filename and preset

```
@dsardar099/pdf-to-html sample.pdf sample.html ipad
```

## Tests

```
$ yarn test
```

## NodeJS Support

This library support nodejs v6+. Anything below v6 may still work but not tested.
