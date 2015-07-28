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

      .init('landing');

  })

  .run(function($rootScope, $state) {
    $rootScope.$state = $state;
  })

  .controller('FrameCtrl', function($scope, $state, $urlManager) {
    $scope.messages = [];

    // Direct call to State
    $scope.callout = function() {
      $state.change('states.define');
    };

    $scope.clearMessages = function() {
      $scope.messages = [];
    };

    $state.on('init', function() {
      console.log('init', $state.current().params);

      $scope.messages.unshift({
        title: 'init',
        body: 'State has initialized.'
      });
      $scope.$apply();
    });

    $state.on('change:complete', function() {
      $scope.messages.unshift({
        title: 'change:complete ('+ $state.current().name +')',
        body: 'State change request has been completed.'
      });
      $scope.$apply();
    });

    $urlManager.on('update', function() {
      console.log('update', $state.current().params);
    });

    $urlManager.on('update:location', function() {
      console.log('update:location', $state.current().params);
    });
  });
