'use strict';

angular
  .module('myApp', [
    'angular-state-router',
    'angular-state-view',
    'angular-state-loadable'
  ])

  .run(function($rootScope, $stateRouter) {
    $rootScope.$stateRouter = $stateRouter;

    $stateRouter

      // Define states
      .state('landing', {
        url: '/'
      })

      .state('products.listing', {
        url: '/products'
      })

      .state('products', {
        url: '/products/:id'
      })

      .state('account', {
        url: '/account'
      })

      // Initialization
      .init('landing');

  })

  .controller('FrameCtrl', function($scope, $stateRouter, $urlManager) {
    $scope.messages = [];

    // Direct call to StateRouter
    $scope.callout = function() {
      $stateRouter.change('products.listing');
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
      console.log('init');
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
