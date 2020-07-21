const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

let folders = [`${__dirname}/dist`];

gulp.task('clean', function () {
    return del(folders);
});
