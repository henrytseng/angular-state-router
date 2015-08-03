'use strict';

/**
 * Execute a series of functions; used in tandem with middleware
 */
var QueueHandler = function() {
  var _list = [];
  var _data = null;

  var _self = {
    add: function(handler) {
      if(handler && handler.constructor === Array) {
        _list = _list.concat(handler);
      } else {
        _list.push(handler);
      }
      return this;
    },

    data: function(data) {
      _data = data;
      return this;
    },

    execute: function(callback) {
      var nextHandler;
      nextHandler = function() {
        var handler = _list.shift();

        // Complete
        if(!handler) {
          return callback(null);

        // Next handler
        } else {
          handler.call(null, _data, function(err) {

            // Error
            if(err) {
              callback(err);

            // Continue
            } else {
              nextHandler();
            }
          });
        }

      };

      nextHandler();
    }

  };
  
  return _self;
};

module.exports = QueueHandler;