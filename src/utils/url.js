'use strict';

function Url() {

}

/**
 * Get the path of a URL
 * 
 * @param  {String} url A URL to test for
 * @return {String}     A querystring from URL
 */
Url.path = function(url) {
  var inflected = (url || '').replace(/\?.*/, '');
  return inflected;
};

/**
 * Get the querystring of a URL
 * 
 * @param  {String} url A URL to test for
 * @return {String}     A querystring from URL
 */
Url.querystring = function(url) {
  var inflected = (url || '').replace(/.*\?/, '');
  return inflected;
};

module.exports = Url;