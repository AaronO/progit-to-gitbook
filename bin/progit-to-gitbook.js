#! /usr/bin/env node

var Q = require('q');
var _ = require('lodash');
var path = require('path');


var convert = require('../');

var LANGS = ['en'];

var DIR = path.resolve(process.argv[2]);
var OUT = path.resolve(process.argv[3]);

if(!DIR || !OUT) {
    console.error('Must provide input & output directory');
    process.exit(1);
}

Q.all(_.map(LANGS, function(lang) {
    return convert(
        path.join(DIR, lang),
        path.join(OUT, lang)
    );
}));
