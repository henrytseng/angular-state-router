'use strict';

var events = require('events');

module.exports = ['$stateRouter', function($stateRouter) {
  
  // Instance of EventEmitter
  var _self = new events.EventEmitter();

  $stateRouter.on('change:render', function() {

  });



  return _self;
}];
