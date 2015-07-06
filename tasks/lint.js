'use strict';

/**
 * Dependencies
 */
var gulp = require('gulp');
var jshint = require('gulp-jshint');
var plumber = require('gulp-plumber');

// Lint
gulp.task('lint', function() {
  return gulp.src('src/**/*.js')
    .pipe(plumber())
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});
