'use strict';

/**
 * Dependencies
 */
var path = require('path');
var gulp = require('gulp');
var watch = require('gulp-watch');

// Watch
gulp.task('watch', function() {

  watch([
    'src/**/*.js'
  ], function() {
    gulp.start('build');
  });

});
