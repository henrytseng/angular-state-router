(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = ['$state', '$viewManager', '$templateCache', '$compile', '$controller', '$q', function ($state, $viewManager, $templateCache, $compile, $controller, $q) {
  return {
    restrict: 'EA',
    priority: 400,
    scope: {

    },
    link: function(scope, $element, attrs) {
      // Create view
      var _view = $viewManager.create(attrs.id, {

        // Element
        $element: $element,

        /**
         * Render view
         * 
         * @param  {String}  template   A template to use
         * @param  {Mixed}   controller A controller to attach applied to scope.$parent
         * @param  {Object}  locals     A data Object to instantiate controller with
         * @return {Promise}            A promise resolved when rendering is complete
         */
        render: function(template, controller, locals) {
          var deferred = $q.defer();

          $element.html(template);

          // Compile
          var link = $compile($element.contents());

          // Controller
          if(controller) {
            var _locals = angular.extend({}, locals || {}, {
              $scope: scope.$parent
            });
            $controller(controller, _locals);
          }

          // Link
          link(scope.$parent);

          deferred.resolve();
          return deferred.promise;
        },

        /**
         * Reset view
         * 
         * @return {Promise} A promise resolved when rendering is complete
         */
        reset: function() {
          var deferred = $q.defer();

          // Empty
          $element.empty();

          deferred.resolve();
          return deferred.promise;
        }
      });

      // Destroy
      $element.on('$destroy', function() {
        _view.destroy();
      });
    }
  };
}];

},{}],2:[function(require,module,exports){
'use strict';

/* global angular:false */

// CommonJS
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'angular-state-view';
}

// Assume polyfill used in StateRouter exists

// Instantiate module
angular.module('angular-state-view', ['angular-state-router'])

  .factory('$viewManager', require('./services/view-manager'))

  .directive('sview', require('./directives/state-view'));

},{"./directives/state-view":1,"./services/view-manager":3}],3:[function(require,module,exports){
'use strict';

/* global window:false */

var View = require('../view/view');

module.exports = ['$rootScope', '$state', '$injector', '$q', function($rootScope, $state, $injector, $q) {

  // Instance
  var _self = {};

  var _viewHash = {};
  var _activeSet = {};

  /**
   * Reset active views
   * 
   * @return {Promise} A promise fulfilled when currently active views are reset
   */
  var _resetActive = function() {
    // Reset views
    var resetPromised = {};
    angular.forEach(_activeSet, function(view, id) {
      resetPromised[id] = $q.when(view.reset());
    });

    // Empty active set
    _activeSet = {};

    return $q.all(resetPromised);
  };

  /**
   * Get templates
   * 
   * @param  {Mixed}   data Template data, String src to include or Function invocation
   * @return {Promise}      A promise fulfilled when templates retireved
   */
  var _getTemplate = function(data) {
    var template = angular.isString(data) ? '<ng-include src="\''+data+'\'"></ng-include>' : $injector.invoke(data);
    return $q.when(template);
  };

  /**
   * Render a view
   * 
   * @param  {String}  id     Unique identifier for view
   * @param  {View}    view   A view instance
   * @param  {Mixed}   data   Template data, String src to include or Function invocation
   * @return {Promise}        A promise fulfilled when currently active view is rendered
   */
  var _renderView = function(id, view, data, controller) {
    return _getTemplate(data).then(function(template) {

      // Controller
      if(controller) {
        var current = $state.current();
        return view.render(template, controller, current.locals);

      // Template only
      } else {
        return view.render(template);
      }
    });
  };

  /**
   * Update rendered views
   *
   * @param {Function} callback A completion callback, function(err)
   */
  var _update = function(callback) {
    // Activate current
    var current = $state.current();

    if(current) {

      // Reset
      _resetActive().then(function() {

        // Render
        var viewsPromised = {};
        var templates = current.templates || {};
        var controllers = current.controllers || {};
        angular.forEach(templates, function(template, id) {
          if(_viewHash[id]) {
            var view = _viewHash[id];
            var controller = controllers[id];
            viewsPromised[id] = _renderView(id, view, template, controller);
            _activeSet[id] = view;
          }
        });

        $q.all(viewsPromised).then(function() {
          callback();
        }, callback);

      }, callback);

    // None
    } else {
      callback();
    }
  };
  _self.$update = _update;

  /**
   * Unregister a view
   * 
   * @param  {String}       id Unique identifier for view
   * @return {$viewManager}    Itself, chainable
   */
  var _unregister = function(id) {
    delete _viewHash[id];
  };

  /**
   * Register a view, also implements destroy method on view to unregister from manager
   * 
   * @param  {String}       id   Unique identifier for view
   * @param  {View}         view A view instance
   * @return {$viewManager}      Itself, chainable
   */
  var _register = function(id, view) {
    // No id
    if(!id) {
      throw new Error('View requires an id.');

    // Require unique id
    } else if(_viewHash[id]) {
      throw new Error('View requires a unique id');

    // Add
    } else {
      _viewHash[id] = view;
    }

    // Check if view is currently active
    var current = $state.current() || {};
    var templates = current.templates || {};
    var controllers = current.controllers || {};
    if(!!templates[id]) {
      _renderView(id, view, templates[id], controllers[id]);
    }

    // Implement destroy method
    view.destroy = function() {
      _unregister(id);
    };

    return view;
  };

  /**
   * A factory method to create a View instance
   * 
   * @param  {String} id   Unique identifier for view
   * @param  {Object} data A data object used to extend abstract methods
   * @return {View}        A View entitity
   */
  _self.create = function(id, data) {
    data = data || {};

    // Create
    var view = View(id, data);

    // Register
    return _register(id, view);
  };

  /**
   * Get a view by id
   * 
   * @param  {String} id Unique identifier for view
   * @return {View}      A View entitity
   */
  _self.get = function(id) {
    return _viewHash[id];
  };

  // Register middleware layer
  $state.$use(function(request, next) {
    _update(function(err) {
      if(err) {
        $rootScope.$broadcast('$viewError', err);
      } else {
        $rootScope.$broadcast('$viewRender');
      }

      next(err);
    });
  });

  return _self;
}];

},{"../view/view":4}],4:[function(require,module,exports){
'use strict';

/**
 * View
 *
 * @param  {String} id      Unique identifier for view
 * @param  {Object} child   A data object used to extend abstract methods
 * @return {View}           An abstract view object
 */
module.exports = function View(id, child) {

  // Instance
  var _self;
  _self = {

    /**
     * Abstract render method
     */
    render: function(template) { },

    /**
     * Abstract reset method
     */
    reset: function() { },

    /**
     * Abstract destroy method
     */
    destroy: function() { }

  };

  // Extend to overwrite abstract methods
  angular.extend(_self, child);

  return _self;
};

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvaGVucnkvSG9tZVN5bmMvQ2FudmFzL3Byb2plY3RzL2FuZ3VsYXItc3RhdGUtdmlldy9zcmMvZGlyZWN0aXZlcy9zdGF0ZS12aWV3LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXZpZXcvc3JjL2luZGV4LmpzIiwiL1VzZXJzL2hlbnJ5L0hvbWVTeW5jL0NhbnZhcy9wcm9qZWN0cy9hbmd1bGFyLXN0YXRlLXZpZXcvc3JjL3NlcnZpY2VzL3ZpZXctbWFuYWdlci5qcyIsIi9Vc2Vycy9oZW5yeS9Ib21lU3luYy9DYW52YXMvcHJvamVjdHMvYW5ndWxhci1zdGF0ZS12aWV3L3NyYy92aWV3L3ZpZXcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQSxPQUFPLFVBQVUsQ0FBQyxVQUFVLGdCQUFnQixrQkFBa0IsWUFBWSxlQUFlLE1BQU0sVUFBVSxRQUFRLGNBQWMsZ0JBQWdCLFVBQVUsYUFBYSxJQUFJO0VBQ3hLLE9BQU87SUFDTCxVQUFVO0lBQ1YsVUFBVTtJQUNWLE9BQU87OztJQUdQLE1BQU0sU0FBUyxPQUFPLFVBQVUsT0FBTzs7TUFFckMsSUFBSSxRQUFRLGFBQWEsT0FBTyxNQUFNLElBQUk7OztRQUd4QyxVQUFVOzs7Ozs7Ozs7O1FBVVYsUUFBUSxTQUFTLFVBQVUsWUFBWSxRQUFRO1VBQzdDLElBQUksV0FBVyxHQUFHOztVQUVsQixTQUFTLEtBQUs7OztVQUdkLElBQUksT0FBTyxTQUFTLFNBQVM7OztVQUc3QixHQUFHLFlBQVk7WUFDYixJQUFJLFVBQVUsUUFBUSxPQUFPLElBQUksVUFBVSxJQUFJO2NBQzdDLFFBQVEsTUFBTTs7WUFFaEIsWUFBWSxZQUFZOzs7O1VBSTFCLEtBQUssTUFBTTs7VUFFWCxTQUFTO1VBQ1QsT0FBTyxTQUFT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Ozs7RUFTdkIsTUFBTSxNQUFNLFNBQVMsSUFBSTtJQUN2QixPQUFPLFVBQVU7Ozs7RUFJbkIsT0FBTyxLQUFLLFNBQVMsU0FBUyxNQUFNO0lBQ2xDLFFBQVEsU0FBUyxLQUFLO01BQ3BCLEdBQUcsS0FBSztRQUNOLFdBQVcsV0FBVyxjQUFjO2FBQy9CO1FBQ0wsV0FBVyxXQUFXOzs7TUFHeEIsS0FBSzs7OztFQUlULE9BQU87O0FBRVQ7O0FDbk1BOzs7Ozs7Ozs7QUFTQSxPQUFPLFVBQVUsU0FBUyxLQUFLLElBQUksT0FBTzs7O0VBR3hDLElBQUk7RUFDSixRQUFROzs7OztJQUtOLFFBQVEsU0FBUyxVQUFVOzs7OztJQUszQixPQUFPLFdBQVc7Ozs7O0lBS2xCLFNBQVMsV0FBVzs7Ozs7RUFLdEIsUUFBUSxPQUFPLE9BQU87O0VBRXRCLE9BQU87O0FBRVQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFsnJHN0YXRlJywgJyR2aWV3TWFuYWdlcicsICckdGVtcGxhdGVDYWNoZScsICckY29tcGlsZScsICckY29udHJvbGxlcicsICckcScsIGZ1bmN0aW9uICgkc3RhdGUsICR2aWV3TWFuYWdlciwgJHRlbXBsYXRlQ2FjaGUsICRjb21waWxlLCAkY29udHJvbGxlciwgJHEpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0VBJyxcbiAgICBwcmlvcml0eTogNDAwLFxuICAgIHNjb3BlOiB7XG5cbiAgICB9LFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCAkZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgIC8vIENyZWF0ZSB2aWV3XG4gICAgICB2YXIgX3ZpZXcgPSAkdmlld01hbmFnZXIuY3JlYXRlKGF0dHJzLmlkLCB7XG5cbiAgICAgICAgLy8gRWxlbWVudFxuICAgICAgICAkZWxlbWVudDogJGVsZW1lbnQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbmRlciB2aWV3XG4gICAgICAgICAqIFxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9ICB0ZW1wbGF0ZSAgIEEgdGVtcGxhdGUgdG8gdXNlXG4gICAgICAgICAqIEBwYXJhbSAge01peGVkfSAgIGNvbnRyb2xsZXIgQSBjb250cm9sbGVyIHRvIGF0dGFjaCBhcHBsaWVkIHRvIHNjb3BlLiRwYXJlbnRcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgbG9jYWxzICAgICBBIGRhdGEgT2JqZWN0IHRvIGluc3RhbnRpYXRlIGNvbnRyb2xsZXIgd2l0aFxuICAgICAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgIEEgcHJvbWlzZSByZXNvbHZlZCB3aGVuIHJlbmRlcmluZyBpcyBjb21wbGV0ZVxuICAgICAgICAgKi9cbiAgICAgICAgcmVuZGVyOiBmdW5jdGlvbih0ZW1wbGF0ZSwgY29udHJvbGxlciwgbG9jYWxzKSB7XG4gICAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgICAgICRlbGVtZW50Lmh0bWwodGVtcGxhdGUpO1xuXG4gICAgICAgICAgLy8gQ29tcGlsZVxuICAgICAgICAgIHZhciBsaW5rID0gJGNvbXBpbGUoJGVsZW1lbnQuY29udGVudHMoKSk7XG5cbiAgICAgICAgICAvLyBDb250cm9sbGVyXG4gICAgICAgICAgaWYoY29udHJvbGxlcikge1xuICAgICAgICAgICAgdmFyIF9sb2NhbHMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgbG9jYWxzIHx8IHt9LCB7XG4gICAgICAgICAgICAgICRzY29wZTogc2NvcGUuJHBhcmVudFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAkY29udHJvbGxlcihjb250cm9sbGVyLCBfbG9jYWxzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBMaW5rXG4gICAgICAgICAgbGluayhzY29wZS4kcGFyZW50KTtcblxuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzZXQgdmlld1xuICAgICAgICAgKiBcbiAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIHJlc29sdmVkIHdoZW4gcmVuZGVyaW5nIGlzIGNvbXBsZXRlXG4gICAgICAgICAqL1xuICAgICAgICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgICAgIC8vIEVtcHR5XG4gICAgICAgICAgJGVsZW1lbnQuZW1wdHkoKTtcblxuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIERlc3Ryb3lcbiAgICAgICRlbGVtZW50Lm9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICBfdmlldy5kZXN0cm95KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59XTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXI6ZmFsc2UgKi9cblxuLy8gQ29tbW9uSlNcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzID09PSBleHBvcnRzKXtcbiAgbW9kdWxlLmV4cG9ydHMgPSAnYW5ndWxhci1zdGF0ZS12aWV3Jztcbn1cblxuLy8gQXNzdW1lIHBvbHlmaWxsIHVzZWQgaW4gU3RhdGVSb3V0ZXIgZXhpc3RzXG5cbi8vIEluc3RhbnRpYXRlIG1vZHVsZVxuYW5ndWxhci5tb2R1bGUoJ2FuZ3VsYXItc3RhdGUtdmlldycsIFsnYW5ndWxhci1zdGF0ZS1yb3V0ZXInXSlcblxuICAuZmFjdG9yeSgnJHZpZXdNYW5hZ2VyJywgcmVxdWlyZSgnLi9zZXJ2aWNlcy92aWV3LW1hbmFnZXInKSlcblxuICAuZGlyZWN0aXZlKCdzdmlldycsIHJlcXVpcmUoJy4vZGlyZWN0aXZlcy9zdGF0ZS12aWV3JykpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgd2luZG93OmZhbHNlICovXG5cbnZhciBWaWV3ID0gcmVxdWlyZSgnLi4vdmlldy92aWV3Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWyckcm9vdFNjb3BlJywgJyRzdGF0ZScsICckaW5qZWN0b3InLCAnJHEnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsICRpbmplY3RvciwgJHEpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGYgPSB7fTtcblxuICB2YXIgX3ZpZXdIYXNoID0ge307XG4gIHZhciBfYWN0aXZlU2V0ID0ge307XG5cbiAgLyoqXG4gICAqIFJlc2V0IGFjdGl2ZSB2aWV3c1xuICAgKiBcbiAgICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIGZ1bGZpbGxlZCB3aGVuIGN1cnJlbnRseSBhY3RpdmUgdmlld3MgYXJlIHJlc2V0XG4gICAqL1xuICB2YXIgX3Jlc2V0QWN0aXZlID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gUmVzZXQgdmlld3NcbiAgICB2YXIgcmVzZXRQcm9taXNlZCA9IHt9O1xuICAgIGFuZ3VsYXIuZm9yRWFjaChfYWN0aXZlU2V0LCBmdW5jdGlvbih2aWV3LCBpZCkge1xuICAgICAgcmVzZXRQcm9taXNlZFtpZF0gPSAkcS53aGVuKHZpZXcucmVzZXQoKSk7XG4gICAgfSk7XG5cbiAgICAvLyBFbXB0eSBhY3RpdmUgc2V0XG4gICAgX2FjdGl2ZVNldCA9IHt9O1xuXG4gICAgcmV0dXJuICRxLmFsbChyZXNldFByb21pc2VkKTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IHRlbXBsYXRlc1xuICAgKiBcbiAgICogQHBhcmFtICB7TWl4ZWR9ICAgZGF0YSBUZW1wbGF0ZSBkYXRhLCBTdHJpbmcgc3JjIHRvIGluY2x1ZGUgb3IgRnVuY3Rpb24gaW52b2NhdGlvblxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiB0ZW1wbGF0ZXMgcmV0aXJldmVkXG4gICAqL1xuICB2YXIgX2dldFRlbXBsYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuaXNTdHJpbmcoZGF0YSkgPyAnPG5nLWluY2x1ZGUgc3JjPVwiXFwnJytkYXRhKydcXCdcIj48L25nLWluY2x1ZGU+JyA6ICRpbmplY3Rvci5pbnZva2UoZGF0YSk7XG4gICAgcmV0dXJuICRxLndoZW4odGVtcGxhdGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXIgYSB2aWV3XG4gICAqIFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBpZCAgICAgVW5pcXVlIGlkZW50aWZpZXIgZm9yIHZpZXdcbiAgICogQHBhcmFtICB7Vmlld30gICAgdmlldyAgIEEgdmlldyBpbnN0YW5jZVxuICAgKiBAcGFyYW0gIHtNaXhlZH0gICBkYXRhICAgVGVtcGxhdGUgZGF0YSwgU3RyaW5nIHNyYyB0byBpbmNsdWRlIG9yIEZ1bmN0aW9uIGludm9jYXRpb25cbiAgICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgIEEgcHJvbWlzZSBmdWxmaWxsZWQgd2hlbiBjdXJyZW50bHkgYWN0aXZlIHZpZXcgaXMgcmVuZGVyZWRcbiAgICovXG4gIHZhciBfcmVuZGVyVmlldyA9IGZ1bmN0aW9uKGlkLCB2aWV3LCBkYXRhLCBjb250cm9sbGVyKSB7XG4gICAgcmV0dXJuIF9nZXRUZW1wbGF0ZShkYXRhKS50aGVuKGZ1bmN0aW9uKHRlbXBsYXRlKSB7XG5cbiAgICAgIC8vIENvbnRyb2xsZXJcbiAgICAgIGlmKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpO1xuICAgICAgICByZXR1cm4gdmlldy5yZW5kZXIodGVtcGxhdGUsIGNvbnRyb2xsZXIsIGN1cnJlbnQubG9jYWxzKTtcblxuICAgICAgLy8gVGVtcGxhdGUgb25seVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZpZXcucmVuZGVyKHRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlIHJlbmRlcmVkIHZpZXdzXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY29tcGxldGlvbiBjYWxsYmFjaywgZnVuY3Rpb24oZXJyKVxuICAgKi9cbiAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIC8vIEFjdGl2YXRlIGN1cnJlbnRcbiAgICB2YXIgY3VycmVudCA9ICRzdGF0ZS5jdXJyZW50KCk7XG5cbiAgICBpZihjdXJyZW50KSB7XG5cbiAgICAgIC8vIFJlc2V0XG4gICAgICBfcmVzZXRBY3RpdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIC8vIFJlbmRlclxuICAgICAgICB2YXIgdmlld3NQcm9taXNlZCA9IHt9O1xuICAgICAgICB2YXIgdGVtcGxhdGVzID0gY3VycmVudC50ZW1wbGF0ZXMgfHwge307XG4gICAgICAgIHZhciBjb250cm9sbGVycyA9IGN1cnJlbnQuY29udHJvbGxlcnMgfHwge307XG4gICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0ZW1wbGF0ZXMsIGZ1bmN0aW9uKHRlbXBsYXRlLCBpZCkge1xuICAgICAgICAgIGlmKF92aWV3SGFzaFtpZF0pIHtcbiAgICAgICAgICAgIHZhciB2aWV3ID0gX3ZpZXdIYXNoW2lkXTtcbiAgICAgICAgICAgIHZhciBjb250cm9sbGVyID0gY29udHJvbGxlcnNbaWRdO1xuICAgICAgICAgICAgdmlld3NQcm9taXNlZFtpZF0gPSBfcmVuZGVyVmlldyhpZCwgdmlldywgdGVtcGxhdGUsIGNvbnRyb2xsZXIpO1xuICAgICAgICAgICAgX2FjdGl2ZVNldFtpZF0gPSB2aWV3O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHEuYWxsKHZpZXdzUHJvbWlzZWQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfSwgY2FsbGJhY2spO1xuXG4gICAgICB9LCBjYWxsYmFjayk7XG5cbiAgICAvLyBOb25lXG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9O1xuICBfc2VsZi4kdXBkYXRlID0gX3VwZGF0ZTtcblxuICAvKipcbiAgICogVW5yZWdpc3RlciBhIHZpZXdcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgaWQgVW5pcXVlIGlkZW50aWZpZXIgZm9yIHZpZXdcbiAgICogQHJldHVybiB7JHZpZXdNYW5hZ2VyfSAgICBJdHNlbGYsIGNoYWluYWJsZVxuICAgKi9cbiAgdmFyIF91bnJlZ2lzdGVyID0gZnVuY3Rpb24oaWQpIHtcbiAgICBkZWxldGUgX3ZpZXdIYXNoW2lkXTtcbiAgfTtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSB2aWV3LCBhbHNvIGltcGxlbWVudHMgZGVzdHJveSBtZXRob2Qgb24gdmlldyB0byB1bnJlZ2lzdGVyIGZyb20gbWFuYWdlclxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICBpZCAgIFVuaXF1ZSBpZGVudGlmaWVyIGZvciB2aWV3XG4gICAqIEBwYXJhbSAge1ZpZXd9ICAgICAgICAgdmlldyBBIHZpZXcgaW5zdGFuY2VcbiAgICogQHJldHVybiB7JHZpZXdNYW5hZ2VyfSAgICAgIEl0c2VsZiwgY2hhaW5hYmxlXG4gICAqL1xuICB2YXIgX3JlZ2lzdGVyID0gZnVuY3Rpb24oaWQsIHZpZXcpIHtcbiAgICAvLyBObyBpZFxuICAgIGlmKCFpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWaWV3IHJlcXVpcmVzIGFuIGlkLicpO1xuXG4gICAgLy8gUmVxdWlyZSB1bmlxdWUgaWRcbiAgICB9IGVsc2UgaWYoX3ZpZXdIYXNoW2lkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWaWV3IHJlcXVpcmVzIGEgdW5pcXVlIGlkJyk7XG5cbiAgICAvLyBBZGRcbiAgICB9IGVsc2Uge1xuICAgICAgX3ZpZXdIYXNoW2lkXSA9IHZpZXc7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdmlldyBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgdmFyIGN1cnJlbnQgPSAkc3RhdGUuY3VycmVudCgpIHx8IHt9O1xuICAgIHZhciB0ZW1wbGF0ZXMgPSBjdXJyZW50LnRlbXBsYXRlcyB8fCB7fTtcbiAgICB2YXIgY29udHJvbGxlcnMgPSBjdXJyZW50LmNvbnRyb2xsZXJzIHx8IHt9O1xuICAgIGlmKCEhdGVtcGxhdGVzW2lkXSkge1xuICAgICAgX3JlbmRlclZpZXcoaWQsIHZpZXcsIHRlbXBsYXRlc1tpZF0sIGNvbnRyb2xsZXJzW2lkXSk7XG4gICAgfVxuXG4gICAgLy8gSW1wbGVtZW50IGRlc3Ryb3kgbWV0aG9kXG4gICAgdmlldy5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICBfdW5yZWdpc3RlcihpZCk7XG4gICAgfTtcblxuICAgIHJldHVybiB2aWV3O1xuICB9O1xuXG4gIC8qKlxuICAgKiBBIGZhY3RvcnkgbWV0aG9kIHRvIGNyZWF0ZSBhIFZpZXcgaW5zdGFuY2VcbiAgICogXG4gICAqIEBwYXJhbSAge1N0cmluZ30gaWQgICBVbmlxdWUgaWRlbnRpZmllciBmb3Igdmlld1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgQSBkYXRhIG9iamVjdCB1c2VkIHRvIGV4dGVuZCBhYnN0cmFjdCBtZXRob2RzXG4gICAqIEByZXR1cm4ge1ZpZXd9ICAgICAgICBBIFZpZXcgZW50aXRpdHlcbiAgICovXG4gIF9zZWxmLmNyZWF0ZSA9IGZ1bmN0aW9uKGlkLCBkYXRhKSB7XG4gICAgZGF0YSA9IGRhdGEgfHwge307XG5cbiAgICAvLyBDcmVhdGVcbiAgICB2YXIgdmlldyA9IFZpZXcoaWQsIGRhdGEpO1xuXG4gICAgLy8gUmVnaXN0ZXJcbiAgICByZXR1cm4gX3JlZ2lzdGVyKGlkLCB2aWV3KTtcbiAgfTtcblxuICAvKipcbiAgICogR2V0IGEgdmlldyBieSBpZFxuICAgKiBcbiAgICogQHBhcmFtICB7U3RyaW5nfSBpZCBVbmlxdWUgaWRlbnRpZmllciBmb3Igdmlld1xuICAgKiBAcmV0dXJuIHtWaWV3fSAgICAgIEEgVmlldyBlbnRpdGl0eVxuICAgKi9cbiAgX3NlbGYuZ2V0ID0gZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gX3ZpZXdIYXNoW2lkXTtcbiAgfTtcblxuICAvLyBSZWdpc3RlciBtaWRkbGV3YXJlIGxheWVyXG4gICRzdGF0ZS4kdXNlKGZ1bmN0aW9uKHJlcXVlc3QsIG5leHQpIHtcbiAgICBfdXBkYXRlKGZ1bmN0aW9uKGVycikge1xuICAgICAgaWYoZXJyKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnJHZpZXdFcnJvcicsIGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJyR2aWV3UmVuZGVyJyk7XG4gICAgICB9XG5cbiAgICAgIG5leHQoZXJyKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIF9zZWxmO1xufV07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVmlld1xuICpcbiAqIEBwYXJhbSAge1N0cmluZ30gaWQgICAgICBVbmlxdWUgaWRlbnRpZmllciBmb3Igdmlld1xuICogQHBhcmFtICB7T2JqZWN0fSBjaGlsZCAgIEEgZGF0YSBvYmplY3QgdXNlZCB0byBleHRlbmQgYWJzdHJhY3QgbWV0aG9kc1xuICogQHJldHVybiB7Vmlld30gICAgICAgICAgIEFuIGFic3RyYWN0IHZpZXcgb2JqZWN0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gVmlldyhpZCwgY2hpbGQpIHtcblxuICAvLyBJbnN0YW5jZVxuICB2YXIgX3NlbGY7XG4gIF9zZWxmID0ge1xuXG4gICAgLyoqXG4gICAgICogQWJzdHJhY3QgcmVuZGVyIG1ldGhvZFxuICAgICAqL1xuICAgIHJlbmRlcjogZnVuY3Rpb24odGVtcGxhdGUpIHsgfSxcblxuICAgIC8qKlxuICAgICAqIEFic3RyYWN0IHJlc2V0IG1ldGhvZFxuICAgICAqL1xuICAgIHJlc2V0OiBmdW5jdGlvbigpIHsgfSxcblxuICAgIC8qKlxuICAgICAqIEFic3RyYWN0IGRlc3Ryb3kgbWV0aG9kXG4gICAgICovXG4gICAgZGVzdHJveTogZnVuY3Rpb24oKSB7IH1cblxuICB9O1xuXG4gIC8vIEV4dGVuZCB0byBvdmVyd3JpdGUgYWJzdHJhY3QgbWV0aG9kc1xuICBhbmd1bGFyLmV4dGVuZChfc2VsZiwgY2hpbGQpO1xuXG4gIHJldHVybiBfc2VsZjtcbn07XG4iXX0=
