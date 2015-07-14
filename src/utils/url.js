'use strict';

function Url(url) {
  url = url || '';

  return {

    /**
     * Get the path of a URL
     * 
     * @return {String}     A querystring from URL
     */
    path: function() {
      var inflected = url.replace(/\?.*/, '');
      return inflected;
    },

    /**
     * Get the querystring of a URL
     * 
     * @return {String}     A querystring from URL
     */
    querystring: function() {
      var inflected = url.replace(/.*\?/, '');
      return inflected;
    }
  };
}


module.exports = Url;