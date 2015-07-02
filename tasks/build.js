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

var _isProduction = process.env.NODE_ENV === 'production';

function _build(file, entries) {

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
      .pipe(gulpif(_isProduction, buffer()))
      .pipe(gulpif(_isProduction, sourcemaps.init()))
      .pipe(gulpif(_isProduction, streamify(uglify({
        compress: { drop_console: true }
      }))))
      .pipe(gulpif(_isProduction, sourcemaps.write('./')))
      .pipe(gulp.dest('dist'));
  }

  return _rebundle();
}

gulp.task('build', function() {
  return _build(_isProduction ? 'state-router.min.js' : 'state-router.js', './src/index.js');
});
