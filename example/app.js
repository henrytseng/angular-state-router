'use strict';

// Instantiate app
angular.module('myApp', [
    'angular-state-router',
    'angular-state-view',
    'angular-state-loadable'
  ])

  // Configuration
  .config(function($stateProvider) {
    $stateProvider

      // Define states
      .state('landing', {
        url: '/',
        templates: {
          contentBody: '/landing.html'
        }
      })

      .state('about', {
        url: '/about',
        templates: {
          contentBody: '/about.html'
        }
      })

      .state('products', {
        url: '/products',
        params: {

          // Inherit by default
          catalog: '1-aeff'
        },
        templates: {
          contentBody: '/products.html'
        }
      })

      .state('products.items', {
        url: '/products/:catalog/:item',
        templates: {
          contentBody: '/products-item.html'
        }
      })

      .state('contact', {
        url: '/contact',
        templates: {
          contentBody: '/contact.html'
        }
      })

      .state('account', {
        url: '/account',
        templates: {
          contentBody: '/account.html'
        }
      })

      .state('account.login', {
        url: '/login',
        templates: {
          contentBody: '/login.html'
        }
      })

      .init('landing');
  })

  // Run
  .run(function($rootScope, $state) {
    $rootScope.$state = $state;
  })

  // Main
  .controller('FrameCtrl', function($scope, $state, $urlManager, $viewManager, $log, $location) {

    // Products catalog
    $scope.products = [
      {item: 'k43131', catalog: '1-aeff', name: 'Phasellus', description: 'Purus sodales ultricies.'},
      {item: 'u43131', catalog: '1-aeff', name: 'Adipiscing', description: 'Facilisis in pretium.'},
      {item: 'e32537', catalog: '1-aeff', name: 'Cras', description: 'Dapibus ac facilisis in.'},
      {item: 'a231', catalog: '1-aeff', name: 'Egestas', description: 'Elit non mi porta.'}, 
      {item: 'r20', catalog: '1-aeff', name: 'Ut', description: 'Sed ut'},
      {item: 's4312', catalog: '1-aeff', name: 'Donec id', description: 'Gravida at eget metus'},
      {item: 'h975', catalog: '1-aeff', name: 'Nullam', description: 'Id dolor id nibh ultricies'},
      {item: 'j239032-1', catalog: '1-aeff', name: 'Dolor', description: 'Nibh ultricies'},
      {item: 'j239032-2', catalog: '1-aeff', name: 'Ipsum', description: 'Eget metus'}
    ];

    // Get product
    $scope.getProduct = function(item) {
      for(var i=0; i<$scope.products.length; i++) {
        if($scope.products[i].item === item) return $scope.products[i];
      }
      return null;
    };

    // Get random product
    $scope.getRandom = function() {
      var i = Math.floor($scope.products.length-1 * Math.random());
      return $scope.products[i];
    };

    // Login state
    $scope.isAuthenticated = false;

    // Direct call to state
    $scope.login = function() {
      $scope.isAuthenticated = true;
      var product = $scope.getRandom();
      $state.change('products.items', {
        catalog: product.catalog,
        item: product.item
      });
    };

    // Direct call to location
    $scope.logout = function() {
      $scope.isAuthenticated = false;
      $location.url('/');
    };

    // Debug messages
    $scope.messages = [];

    // Clear debugging messages
    $scope.clearMessages = function() {
      $scope.messages = [];
    };

    // Listen to initialization
    $state.on('init', function() {
      $log.log('init');
      $scope.messages.unshift({
        title: 'init',
        body: 'State has initialized.'
      });
      $scope.$apply();
    });

    // Listen to state changes
    $state.on('change:complete', function() {
      $log.log('change:complete ('+ $state.current().name +')');
      $scope.messages.unshift({
        title: 'change:complete ('+ $state.current().name +')',
        body: 'State change request has been completed.'
      });
      $scope.$apply();
    });
  })

  // Product details
  .controller('ProductCtrl', function($scope, $state) {
    $scope.product = $scope.getProduct($state.current().params.item);

    // Get unique list of recommendations
    var _getRecommendations = function() {
      var list = $scope.products.slice(0);
      return list
        .filter(function(entity) {
          return entity.item !== $scope.product.item;
        })
        .sort(function() {
          return Math.random() > 0.5;
        })
        .splice(0,6);
    };
    $scope.recommendations = _getRecommendations();
  });
