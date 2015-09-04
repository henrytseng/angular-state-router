'use strict';

module.exports = ['$q', '$injector', '$state', '$rootScope', function($q, $injector, $state, $rootScope) {

  // Instance
  var _self = {};

  /**
   * Process actions
   * 
   * @param  {Object}  actions An array of actions items
   * @return {Promise}         A promise fulfilled when actions processed
   */
  var _act = function(actions) {
    var actionPromises = [];

    angular.forEach(actions, function(value) {
      var action = angular.isString(value) ? $injector.get(value) : $injector.invoke(value);
      actionPromises.push($q.when(action));
    });

    return $q.all(actionPromises);
  };
  _self.process = _act;

  /**
   * Register middleware layer
   */
  _self.$ready = function() {

    $state.$use(function(request, next) {
      var current = $state.current();

      if(!current) {
        return next();
      }

      $rootScope.$broadcast('$stateActionBegin');

      _act(current.actions || []).then(function() {
        $rootScope.$broadcast('$stateActionEnd');
        next();

      }, function(err) {
        $rootScope.$broadcast('$stateActionError', err);
        next(new Error('Error processing state actions'));
      });
    }, 100);

  };

  return _self;
}];
