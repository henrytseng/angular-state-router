'use strict';

/**
 * Dependencies
 */
var gulp = require('gulp');
var gulpif = require('gulp-if');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var buffer = require('vinyl-buffer');
var streamify = require('gulp-streamify');
var browserify = require('browserify');
var uglify = require('gulp-uglify');
var ngAnnotate = require('browserify-ngannotate');

function _build(file, entries, isMin) {
  var bundler = browserify({
    entries: entries,
    debug: true,
    cache: {},
    packageCache: {}
  });

  bundler.transform(ngAnnotate);

  function _rebundle() {
    var stream = bundler.bundle();

    return stream.on('error', function(err) {
      console.error(err.stack || err);
      this.emit('end');
    })
      .pipe(source(file))
      .pipe(gulpif(isMin, buffer()))
      .pipe(gulpif(isMin, sourcemaps.init()))
      .pipe(gulpif(isMin, streamify(uglify({
        compress: { drop_console: true }
      }))))
      .pipe(gulpif(isMin, sourcemaps.write('./')))
      .pipe(gulp.dest('dist'));
  }

  return _rebundle();
}

gulp.task('build', ['build:normal', 'build:min']);

gulp.task('build:min', function() {
  return _build('state-router.min.js', './src/state-router.js', true);
});
gulp.task('build:normal', function() {
  return _build('state-router.js', './src/state-router.js');
});
