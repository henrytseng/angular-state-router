'use strict';

describe('Url', function() {
  var Url = require('../../../src/utils/url');

  describe('#path', function() {
    it('Should get url path', function() {
      expect(Url('/pets/cat/color?hue=green').path()).toBe('/pets/cat/color');
    });
  });

  describe('#querystring', function() {
    it('Should get url querystring', function() {
      expect(Url('/pets/cat/color?hue=green&tint=2390').querystring()).toBe('hue=green&tint=2390');
    });
  });

});
