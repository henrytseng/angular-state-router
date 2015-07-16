'use strict';

/**
 * Curry a function
 * 
 * @param {String}    handler A function to curry
 * @return {Function}         A curried function
 */
var Curry = function(handler) {
  var args = Array.prototype.slice.call(arguments, 1);

  var _self = function() {
    return handler.apply(
      this, 
      args.concat(Array.prototype.slice.call(arguments, 0))
    );
  };

  return _self;
};

module.exports = Curry;
