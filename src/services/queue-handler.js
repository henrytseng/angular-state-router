'use strict';

module.exports = ['$rootScope', function($rootScope) {

  /**
   * Execute a series of functions; used in tandem with middleware
   */
  var Queue = function() {
    var _list = [];
    var _data = null;

    var _self = {

      /**
       * Add a handler
       * 
       * @param {Mixed}  handler A Function or an Array of Functions to add to the queue
       * @return {Queue}         Itself; chainable
       */
      add: function(handler) {
        if(handler && handler.constructor === Array) {
          _list = _list.concat(handler);
        } else {
          _list.push(handler);
        }
        return this;
      },

      /**
       * Data object
       * 
       * @param  {Object} data A data object made available to each handler
       * @return {Queue}       Itself; chainable
       */
      data: function(data) {
        _data = data;
        return this;
      },

      /**
       * Begin execution and trigger callback at the end
       * 
       * @param  {Function} callback A callback, function(err)
       * @return {Queue}             Itself; chainable
       */
      execute: function(callback) {
        var nextHandler;
        var executionList = _list.slice(0).sort(function(a, b) {
          return (a.priotity || 1) < (b.priotity || 1);
        });

        nextHandler = function() {
          $rootScope.$evalAsync(function() {
            var handler = executionList.shift();

            // Complete
            if(!handler) {
              callback(null);

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
          });
        };

        // Start
        nextHandler();
      }

    };
    
    return _self;
  };

  // Instance
  return {

    /**
     * Factory method
     * 
     * @return {Queue} A queue
     */
    create: function() {
      return Queue();
    }
  };
}];
