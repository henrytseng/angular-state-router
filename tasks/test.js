'use strict';

/**
 * Dependencies
 */
var gulp = require('gulp');
var karma = require('karma').server;

// Watch
gulp.task('test', function(done) {

  karma.start({
    configFile: process.cwd()+'/tests/karma.conf.js',
    singleRun: true
  }, done);

});
