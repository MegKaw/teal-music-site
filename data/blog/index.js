// data/blog/index.js
const guitar = require('./guitar');
const vocal = require('./vocal');
const bass = require('./bass');
const dtm = require('./dtm');
const ukulele = require('./ukulele');
const musical = require('./musical');

module.exports = [...guitar, ...vocal, ...bass, ...dtm, ...ukulele, ...musical];