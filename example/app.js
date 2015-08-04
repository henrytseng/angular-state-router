'use strict';

angular
  .module('myApp', [
    'angular-state-router',
    'angular-state-view',
    'angular-state-loadable'
  ])

  .config(function($stateProvider) {
    $stateProvider

      // Define states
      .state('gettingstarted', {
        url: '/'
      })

      .state('api', {
        url: '/api'
      })

      .state('api.methods', {
        url: '/api/:method'
      })

      .state('components', {
        url: '/components',
        templates: {
          contentBody: function($templateCache) {
            return 'fadfsdfasd';
          }
        }
      })

      .state('components.modules', {
        url: '/components/:module'
      })

      .state('experiment', {
        url: '/experiment'
      })

      .init('gettingstarted');
  })

  .run(function($rootScope, $state) {
    $rootScope.$state = $state;
  })

  .controller('FrameCtrl', function($scope, $state, $urlManager, $viewManager, $log) {
    $scope.messages = [];

    $scope.additional = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.";

    // Direct call to State
    $scope.callout = function() {
      $state.change('states.define');
    };

    $scope.clearMessages = function() {
      $scope.messages = [];
    };

    $state.on('init', function() {
      $log.log('init');
      $scope.messages.unshift({
        title: 'init',
        body: 'State has initialized.'
      });
      $scope.$apply();
    });

    $state.on('change:complete', function() {
      $log.log('change:complete ('+ $state.current().name +')');
      $scope.messages.unshift({
        title: 'change:complete ('+ $state.current().name +')',
        body: 'State change request has been completed.'
      });
      $scope.$apply();
    });

  });
