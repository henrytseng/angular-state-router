'use strict';

describe('Url', function() {
  var Url = require('../../../src/utils/url');

  describe('#path', function() {
    it('Should get url path', function() {
      expect(Url('/pets/cat/color?hue=green').path()).toBe('/pets/cat/color');
    });

    it('Should fallback without `?`', function() {
      expect(Url('/pets/cat/color').path()).toBe('/pets/cat/color');
    });

    it('Should fallback with only querystring', function() {
      expect(Url('?').path()).toBe('');
    });
  });

  describe('#querystring', function() {
    it('Should get url querystring', function() {
      expect(Url('/pets/cat/color?hue=green&tint=2390').querystring()).toBe('hue=green&tint=2390');
    });

    it('Should fallback without `?`', function() {
      expect(Url('/pets/cat/color').querystring()).toBe('');
    });

    it('Should fallback with only querystring', function() {
      expect(Url('?hue=green&tint=2390').querystring()).toBe('hue=green&tint=2390');
    });
  });

  describe('#queryparams', function() {
    it('Should get url querystring as a hash', function() {
      expect(Url('/pets/cat/color?hue=green&tint=2390').queryparams()).toEqual({
        hue: 'green',
        tint: '2390'
      });
    });

    it('Should fallback without `?`', function() {
      expect(Url('/pets/cat/color').queryparams()).toEqual({});
    });

    it('Should fallback with only querystring', function() {
      expect(Url('?hue=green&tint=2390').queryparams()).toEqual({
        hue: 'green',
        tint: '2390'
      });
    });
  });

});
