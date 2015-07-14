'use strict';

describe('Url', function() {
  var Url = require('../../../src/utils/url');

  describe('#path', function() {
    it('Should get url path', function() {
      expect(Url.path('/pets/cat/color?hue=green')).toBe('/pets/cat/color');
    });
  });

  describe('#querystring', function() {
    it('Should get url querystring', function() {
      expect(Url.querystring('/pets/cat/color?hue=green&tint=2390')).toBe('hue=green&tint=2390');
    });
  });

});
