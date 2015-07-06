'use strict';

/**
 * Dependencies
 */
var path = require('path');
var gulp = require('gulp');
var watch = require('gulp-watch');
var runSequence = require('run-sequence');

// Watch
gulp.task('watch', function() {

  watch([
    'src/**/*.js',
    'tests/spec/**/*.spec.js'
  ], function() {
    runSequence('lint', 'build', 'test');
  });

});
