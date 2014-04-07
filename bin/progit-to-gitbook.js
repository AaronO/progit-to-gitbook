#! /usr/bin/env node

var Q = require('q');
var _ = require('lodash');
var path = require('path');

var fs = require('../lib/fs');

var langs = require('../lib/langs');
var convert = require('../');

var LANGS = _.keys(langs);

var DIR = path.resolve(process.argv[2]);
var OUT = path.resolve(process.argv[3]);


function listItem(title, path) {
    return '* ['+title+']'+'('+path+')';
}

function genLangs() {
    return _.map(langs, function(name, code) {
        return listItem(name, code);
    }).join('\t\n');
}

function READMEs() {
    return _.map(LANGS, function(lang) {
        return path.join(OUT, lang, 'README.md');
    }).concat([path.join(OUT, 'README.md')]);
}

if(!DIR || !OUT) {
    console.error('Must provide input & output directory');
    process.exit(1);
}

Q.all(_.map(LANGS, function(lang) {
    return convert(
        path.join(DIR, lang),
        path.join(OUT, lang)
    );
}))
.then(function() {
    return fs.readFile(path.join(__dirname, '../data/README.md'), 'utf8');
})
.then(function(README) {
    return Q.all(READMEs().map(function(readme) {
        return fs.writeFile(readme, README);
    }));
})
.then(function() {
    return fs.writeFile(path.join(OUT, 'LANGS.md'), genLangs());
})
.fail(function(err) {
    console.log(err.stack);
});

