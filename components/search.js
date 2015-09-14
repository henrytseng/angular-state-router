(function() {
  'use strict';

  // Define states
  example.myApp.deferred

    .state('search', {
      url: '/search',
      templates: {
        layout: 'angular-state-router/layouts/one-col.html',
        contentBody: 'angular-state-router/screens/search.html',
        contentFooter: 'angular-state-router/common/footer.html'
      },
      controllers: {
        contentBody: 'SearchController'
      }
    });

  // Define controllers
  example.myApp.deferred

    .controller('SearchController', function($scope, Product, $location) {
      $scope.products = [];

      $scope.search = function() {
        Product.search(($scope.search.criteria || '').split(' ')).then(function(products) {
          $scope.products = products;
        });
      };

      $scope.search.criteria = $location.search().q || '';

      if($scope.search.criteria && $scope.search.criteria !== '') {
        $scope.search();
      }
    });

})();
