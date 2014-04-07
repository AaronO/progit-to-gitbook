var Q = require('q');
var _ = require('lodash');

var path = require('path');

var fs = require('./lib/fs');


function repeat(str, n) {
    return _.chain(n)
    .range()
    .map(_.constant(str))
    .value().join('');
}

function convertChapter(content) {
    var parts = content.split('\n## ');
    var README = parts[0];

    var articles = _.map(parts.slice(1), function(src) {
        return '## ' + src;
    });

    return {
        readme: README,
        articles: articles
    };
}

function titleToPath(title) {
    return title.toLowerCase().replace(/[ -]/g, '_');
}

function parseChapter(_path, fullpath) {
    var matches = _path.match(/^\d+-(.*)\/0\d-chapter(\d+).markdown$/);
    if(!matches) {
        throw new Error('Failed to handle, '+_path);
    }

    // Extract title and chapter number
    var title = matches[1].replace(/-/g, ' ');
    var num = parseInt(matches[2], 10);

    return fs.readFile(fullpath, 'utf8')
    .then(convertChapter)
    .then(function(parts) {
        return {
            num: num,
            title: chapterTitle(parts.readme),
            readme: fixMarkdown(parts.readme),
            articles: _.map(parts.articles, function(content) {
                return {
                    title: articleTitle(content),
                    content: fixMarkdown(content)
                };
            })
        };
    });
}

function articleTitle(content) {
    var matches = content.match(/## (.+) .*/);
    if(!matches) {
        throw Error('No title found');
    }
    return matches[1];
}

function chapterTitle(content) {
    var matches = content.match(/# (.+) .*/);
    if(!matches) {
        throw Error('No title found');
    }
    return matches[1];
}

function fixMarkdown(content) {
    return fixTables(
    fixFixgures(
    fixTitles(
            content
    )));
}

function fixTitles(content) {
    return content.replace(/(#+) (.+) (#+)/g, function(matched, left, middle, right) {
        var newHr = repeat('#', _.max([1, left.length-1]));
        return [newHr, middle].join(' ');
    });
}

function fixFixgures(content) {
    return content.replace(/Insert 18333fig(\d{4}).png/g, function(matched, imgId) {
        return '\n' +
        '![](http://git-scm.com/figures/18333fig'+imgId+'-tn.png)' +
        '\n';
    });
}

function parseRow(row) {
    return row.split('\t').slice(1);
}

function genRow(row) {
    return [''].concat(row).concat(['']).join('|');
}

function fixTables(content) {
    return content.replace(/\n\n<!-- Attention [\s\S]*?-->\n\n([\s\S]*?)\n\n/g, function(match, tableText) {
        var lines = tableText.split('\n');
        var head = parseRow(_.first(lines));
        var sep = _.map(head, function(col) { return repeat('-', col.length); });
        var body = _.rest(lines).map(parseRow);

        return ['', [head].concat([sep]).concat(body).map(genRow).join('\n'), ''].join('\n\n');
    });
}

function chapterPath(chapter) {
    return titleToPath(chapter.title);
}

function readmePath(chapter) {
    return path.join(
        chapterPath(chapter),
        'README.md'
    );
}

function articlePath(chapter, article) {
    return path.join(
        chapterPath(chapter),
        titleToPath(article.title)+'.md'
    );
}

function listItem(title, path) {
    return '* ['+title+']'+'('+path+')';
}

function genChapterSummary(chapter) {
    return [listItem(chapter.title, readmePath(chapter))]
    .concat(_.map(chapter.articles, function(article) {
        return listItem(
            article.title,
            articlePath(chapter, article)
        );
    })).join('\n\t');
}

function genSummary(chapters) {
    return _.map(chapters, genChapterSummary).join('\n');
}


function writeChapter(chapter, outdir) {
    var _path = path.join(outdir, chapterPath(chapter));

    var write = function(subpath, content) {
        return fs.writeFile(path.join(_path, subpath), content);
    };

    return fs.mkdirp(_path)
    .then(function() {
        return write('README.md', chapter.readme);
    })
    .then(function() {
        return Q.all(_.map(chapter.articles, function(article) {
            return write(titleToPath(article.title)+'.md', article.content);
        }));
    });
}

function convertDir(dirpath, outdir) {
    var write = function(subpath, content) {
        return fs.writeFile(
            path.join(outdir, subpath),
            content
        );
    };

    // Cleanup
    return fs.remove(outdir)
    .then(function() {
        return fs.mkdirp(outdir);
    })
    .then(function() {
        return fs.list(dirpath);
    })
    .then(function(files) {
        // Filter out folders
        return _.filter(files, function(file) {
            return _.last(file) !== '/';
        });
    })
    .then(function(files) {
        // Filter out non markdownish files
        return _.filter(files, function(file) {
            return _.first(file) === '0';
        });
    })
    .then(function(files) {
        return Q.all(_.map(files, function(file) {
            return parseChapter(file, path.join(dirpath, file));
        }));
    })
    .then(function(chapters) {
        var summary = genSummary(chapters);

        return write('SUMMARY.md', summary)
        .then(function() {
            return Q.all(_.map(chapters, function(chapter) {
                return writeChapter(chapter, outdir);
            }));
        });
    })
    .then(function() {
        return write('README.md', 'EMPTY ... ');
    })
    .fail(function(err) {
        console.log('ERROR');
        console.error(err);
    });
}

// Exports
module.exports = convertDir;
