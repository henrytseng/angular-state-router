'use strict';

angular
  .module('myApp', [
    'angular-state-router',
    'angular-state-view',
    'angular-state-loadable'
  ])

  .run(function($rootScope, $stateRouter, $location) {
    $rootScope.$stateRouter = $stateRouter;

    $stateRouter

      // Define states
      .state('landing', {
        url: '/'
      })

      .state('notation', {
        url: '/notation'
      })

      .state('states', {
        url: '/states'
      })

      .state('events', {
        url: '/events'
      })

      .state('events.details', {
        url: '/events/:id',
        params: {
          id: 'init'
        }
      })

      .state('loadables', {
        url: '/loadables'
      })

      .state('views', {
        url: '/views'
      })

      // Initialization
      .init('landing');

  })

  .controller('FrameCtrl', function($scope, $stateRouter, $urlManager) {
    $scope.messages = [];

    // Direct call to StateRouter
    $scope.callout = function() {
      $stateRouter.change('states.define');
    };

    $scope.clearMessages = function() {
      $scope.messages = [];
    };

    $stateRouter.on('init', function() {
      $scope.messages.unshift({
        title: 'init',
        body: 'StateRouter has initialized.'
      });
      $scope.$apply();
    });

    $stateRouter.on('change:complete', function() {
      $scope.messages.unshift({
        title: 'change:complete ('+ $stateRouter.current().name +')',
        body: 'State change request has been completed.'
      });
      $scope.$apply();
    });

    $urlManager.on('update', function() {
      console.log('update');
    });

    $urlManager.on('update:location', function() {
      console.log('update:location');
    });
  });
