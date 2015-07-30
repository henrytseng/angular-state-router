'use strict';


angular.module('myApp')
  .directive('sview', ['$state', '$viewManager', '$templateCache', '$compile', function ($state, $viewManager, $templateCache, $compile) {

    return {
      restrict: 'EA',
      scope: {

      },
      link: function(scope, element, attrs) {
        var _render = function() {
          var renderer = $compile($templateCache.get(attrs.template));
          element.html(renderer(scope.$parent));
        };

        if(attrs.id) {
          $viewManager.register(attrs.id, this, _render);
        }
      }
    };
  }]);