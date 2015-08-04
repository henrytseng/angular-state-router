'use strict';

var process = require('../utils/process');

module.exports = ['$state', '$rootScope', function ($state, $rootScope) {
  $state.on('change:complete', function() {
    $rootScope.$apply();
  });

  return {
    restrict: 'A',
    scope: {
    },
    link: function(scope, element, attrs) {
      element.css('cursor', 'pointer');
      element.on('click', function(e) {
        $state.change(attrs.sref);
        e.preventDefault();
      });
    }

  };
}];
