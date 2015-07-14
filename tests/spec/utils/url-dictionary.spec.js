'use strict';

describe('UrlDictionary', function() {
  var UrlDictionary = require('../../../src/utils/url-dictionary');

  describe('#add', function() {
    it('Should associate a url with a reference', function() {
      var ud = new UrlDictionary();

      ud.add('/products/:id', {
        lorem: 'ipsum'
      });
    });
  });

  describe('#lookup', function() {
    it('Should retrieve added references according to the url pattern', function() {
      var ud = new UrlDictionary();
      var data1, data2, data3, data4;

      ud.add('/pets/:id', data1 = { dolor: 'sed' });
      expect(ud.lookup('/pets/cat')).toBe(data1);

      ud.add('/pets/:id/color', data2 = { lorem: 'sed' });
      expect(ud.lookup('/pets/cat/color')).toBe(data2);

      // Matches newest
      ud.add('/pets/:id/color?hue', data3 = { ut: 'sed' });
      expect(ud.lookup('/pets/cat/color?hue=green')).toBe(data3);
      expect(ud.lookup('/pets/cat/color?hue=green')).not.toBe(data2);

      // Including escape characters
      ud.add('/pets/:id/variety%20type/:type', data4 = { ipsum: 'sed' });
      expect(ud.lookup('/pets/dog/variety%20type/poodle')).toBe(data4);
    });
  });

  describe('#path', function() {
    it('Should get url path', function() {
      expect(UrlDictionary.path('/pets/cat/color?hue=green')).toBe('/pets/cat/color');
    });
  });

  describe('#querystring', function() {
    it('Should get url querystring', function() {
      expect(UrlDictionary.querystring('/pets/cat/color?hue=green&tint=2390')).toBe('hue=green&tint=2390');
    });
  });

});
