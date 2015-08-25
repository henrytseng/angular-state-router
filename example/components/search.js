(function() {
  'use strict';

  // Access current injector
  var $injector = angular.element(document).injector();

  var $state = $injector.get('$state');
  var myApp = angular.module('myApp');

  // Redefine state
  $state.state('search', {
    templates: {
      layout: 'layouts/one-col.html',
      contentBody: 'screens/search.html',
      contentFooter: 'common/footer.html'
    }
  });

})();